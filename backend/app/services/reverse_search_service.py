"""
ShieldHer – Reverse Image Search Orchestration Service.

RESPONSIBILITIES & CONSTRAINTS:
1. Enforces affirmative informed user consent immediately prior to any external data transfer.
2. Applies per-minute rate limits and daily case budgets tracked in Redis.
3. Preserves idempotency: avoids automatically repeating external searches without explicit refresh.
4. Keeps external search results strictly segregated from ML AI-detection scores.
5. Emphasizes that 0 returned matches NEVER implies an image has not appeared online.
6. Does not scrape social media or bypass access controls.
"""
from __future__ import annotations

import datetime
from typing import Any, Dict, List, Optional, Tuple
import uuid
from fastapi import HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
import structlog

from app.config import get_settings
from app.database import get_db_session
from app.models.entities import AuditLog, Case, EvidenceItem, ReverseSearchResult, User
from app.schemas.reverse_search import (
    ConsentDisclosureResponse,
    MatchCategory,
    ReverseSearchConsent,
    ReverseSearchHistoryItem,
    ReverseSearchResponse,
    SearchMatchItem,
    SearchStatus,
)
from app.services.auth_service import check_case_ownership_or_permission
from app.services.crypto_service import CryptoService, get_crypto_service
from app.services.local_comparison_service import LocalComparisonService, get_local_comparison_service
from app.services.redis_service import RedisService, get_redis_service
from app.services.serpapi_lens_adapter import SerpApiGoogleLensAdapter, get_serpapi_adapter
from app.services.storage_service import ObjectStorageInterface, get_storage_service

logger = structlog.get_logger(__name__)


def _utc_now() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)


class ReverseSearchService:
    def __init__(
        self,
        adapter: Optional[SerpApiGoogleLensAdapter] = None,
        crypto: Optional[CryptoService] = None,
        storage: Optional[ObjectStorageInterface] = None,
        redis_svc: Optional[RedisService] = None,
        local_comp: Optional[LocalComparisonService] = None,
    ):
        self.settings = get_settings()
        self._adapter = adapter
        self._crypto = crypto
        self._storage = storage
        self._redis = redis_svc
        self._local_comp = local_comp

    @property
    def adapter(self) -> SerpApiGoogleLensAdapter:
        return self._adapter or get_serpapi_adapter()

    @property
    def crypto(self) -> CryptoService:
        return self._crypto or get_crypto_service()

    @property
    def storage(self) -> ObjectStorageInterface:
        return self._storage or get_storage_service()

    @property
    def redis(self) -> RedisService:
        return self._redis or get_redis_service()

    @property
    def local_comp(self) -> LocalComparisonService:
        return self._local_comp or get_local_comparison_service()

    # ── 1. Consent Disclosure & Search Budget ──────────────────────────

    async def get_consent_disclosure(
        self,
        case: Case,
        evidence: EvidenceItem,
    ) -> ConsentDisclosureResponse:
        """
        Returns structured disclosure explaining what will be transferred,
        which external provider will receive it, and current budget remaining.
        """
        daily_limit = self.settings.reverse_search_daily_budget_per_case
        budget_remaining, _ = await self.redis.get_search_budget_remaining(str(case.id), daily_limit)

        return ConsentDisclosureResponse(
            evidence_id=str(evidence.id),
            filename_sanitized=evidence.filename_sanitized,
            original_sha256=evidence.original_sha256,
            target_provider="SerpApi (Google Lens API, engine=google_lens)",
            daily_budget_remaining=budget_remaining,
            daily_budget_limit=daily_limit,
            can_search=(budget_remaining > 0 and self.adapter.is_configured),
        )

    # ── 2. Reverse Search Execution ────────────────────────────────────

    async def execute_reverse_search(
        self,
        session: AsyncSession,
        case: Case,
        evidence: EvidenceItem,
        user: User,
        consent: ReverseSearchConsent,
        force_refresh: bool = False,
        public_image_url: Optional[str] = None,
    ) -> ReverseSearchResponse:
        """
        Executes reverse image search with strict consent, rate limiting, and budgeting.
        """
        # 1. Require explicit user consent immediately before transferring an image
        if not consent.consent_to_external_search:
            logger.warning(
                "Reverse search rejected: missing affirmative consent",
                case_id=str(case.id),
                evidence_id=str(evidence.id),
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Explicit affirmative consent is required immediately before transferring an image to an external provider.",
            )

        # 2. Check rate limit per minute
        rate_limit_ok = await self.redis.check_rate_limit(
            f"user:{user.id}",
            max_requests=self.settings.reverse_search_rate_limit_per_minute,
            window_seconds=60,
        )
        if not rate_limit_ok:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Reverse search rate limit exceeded ({self.settings.reverse_search_rate_limit_per_minute} req/min). Please wait before trying again.",
            )

        daily_limit = self.settings.reverse_search_daily_budget_per_case

        # 3. Idempotency: Do not automatically repeat searches unless force_refresh is requested
        if not force_refresh:
            q_existing = (
                select(ReverseSearchResult)
                .where(
                    ReverseSearchResult.case_id == case.id,
                    ReverseSearchResult.evidence_id == evidence.id,
                )
                .order_by(desc(ReverseSearchResult.created_at))
            )
            res = await session.execute(q_existing)
            existing = res.scalars().first()
            if existing:
                budget_rem, _ = await self.redis.get_search_budget_remaining(str(case.id), daily_limit)
                exact_items = [
                    SearchMatchItem(**item) for item in existing.exact_matches
                ]
                visual_items = [
                    SearchMatchItem(**item) for item in existing.visual_matches
                ]
                return ReverseSearchResponse(
                    search_id=str(existing.id),
                    case_id=str(case.id),
                    evidence_id=str(evidence.id),
                    status=SearchStatus(existing.status),
                    provider=existing.provider,
                    search_timestamp=existing.created_at,
                    duration_ms=existing.search_duration_ms,
                    query_image_sha256=existing.query_image_sha256,
                    query_phash=existing.query_phash,
                    exact_matches_count=existing.exact_matches_count,
                    visual_matches_count=existing.visual_matches_count,
                    exact_matches=exact_items,
                    visual_matches=visual_items,
                    returned_urls=existing.returned_urls,
                    budget_remaining=budget_rem,
                    explanation=(
                        "Retrieved existing reverse search results from cache. Automatic re-queries "
                        "are disabled to prevent duplicate external data transfers and protect victim privacy."
                    ),
                    disclaimer=existing.disclaimer,
                )

        # 4. Check & consume daily search budget
        allowed, budget_remaining, _ = await self.redis.check_and_consume_search_budget(
            str(case.id), daily_limit=daily_limit
        )
        if not allowed:
            logger.warning("Daily search budget exhausted for case", case_id=str(case.id))
            return ReverseSearchResponse(
                case_id=str(case.id),
                evidence_id=str(evidence.id),
                status=SearchStatus.QUOTA_EXCEEDED,
                provider="SerpApi Google Lens",
                search_timestamp=_utc_now(),
                query_image_sha256=evidence.original_sha256,
                budget_remaining=0,
                explanation=f"Daily search budget of {daily_limit} searches for this case has been reached.",
            )

        # 5. Retrieve & decrypt evidence in memory to compute perceptual hash
        if evidence.is_deleted or not evidence.storage_key_encrypted_evidence:
            raise HTTPException(status_code=status.HTTP_410_GONE, detail="Evidence item has been purged.")

        encrypted_bytes = self.storage.load_file(evidence.storage_key_encrypted_evidence)
        decrypted_bytes = self.crypto.decrypt_evidence(encrypted_bytes, evidence.encryption_iv_hex)
        query_hashes = self.local_comp.compute_all_hashes(decrypted_bytes)

        # 6. Determine image URL for external provider transfer
        # Note: If no external public URL is supplied in dev, fallback to placeholder/mockable URL
        target_url = public_image_url or f"https://evidence.shieldher.internal/cache/{evidence.id}.jpg"

        # 7. Execute search with external adapter
        search_out = await self.adapter.search(image_url=target_url)

        # 8. Record search timestamp, provider, returned URLs, and status in PostgreSQL
        record = ReverseSearchResult(
            id=uuid.uuid4(),
            case_id=case.id,
            evidence_id=evidence.id,
            requested_by_user_id=user.id,
            provider=search_out.provider,
            status=search_out.status.value,
            query_image_sha256=query_hashes["sha256"],
            query_phash=query_hashes["phash"],
            exact_matches_count=len(search_out.exact_matches),
            visual_matches_count=len(search_out.visual_matches),
            exact_matches=[item.model_dump() for item in search_out.exact_matches],
            visual_matches=[item.model_dump() for item in search_out.visual_matches],
            returned_urls=search_out.returned_urls,
            search_duration_ms=search_out.search_duration_ms,
            consent_confirmed=True,
            consent_timestamp=_utc_now(),
            disclaimer=(
                "CRITICAL NOTICE: Google Lens index searches reflect publicly crawled internet pages. "
                "A lack of search results DOES NOT prove that an image has never been disseminated online; "
                "private messaging services, paywalled websites, and unindexed platforms are not covered. "
                "Conversely, visual matches denote algorithmic visual similarity and do not establish "
                "that the depicted subject or source is identical."
            ),
        )
        session.add(record)

        # 9. Immutable audit log entry
        audit = AuditLog(
            case_id=case.id,
            user_id=user.id,
            action="REVERSE_IMAGE_SEARCH_EXECUTED",
            details_json={
                "search_id": str(record.id),
                "evidence_id": str(evidence.id),
                "provider": search_out.provider,
                "status": search_out.status.value,
                "exact_count": len(search_out.exact_matches),
                "visual_count": len(search_out.visual_matches),
                "urls_count": len(search_out.returned_urls),
            },
        )
        session.add(audit)
        await session.commit()
        await session.refresh(record)

        return ReverseSearchResponse(
            search_id=str(record.id),
            case_id=str(case.id),
            evidence_id=str(evidence.id),
            status=search_out.status,
            provider=record.provider,
            search_timestamp=record.created_at,
            duration_ms=record.search_duration_ms,
            query_image_sha256=record.query_image_sha256,
            query_phash=record.query_phash,
            exact_matches_count=record.exact_matches_count,
            visual_matches_count=record.visual_matches_count,
            exact_matches=search_out.exact_matches,
            visual_matches=search_out.visual_matches,
            returned_urls=record.returned_urls,
            budget_remaining=budget_remaining,
            explanation=search_out.explanation,
            disclaimer=record.disclaimer,
        )

    # ── 3. Search History ──────────────────────────────────────────────

    async def list_searches_for_evidence(
        self,
        session: AsyncSession,
        case_id: uuid.UUID,
        evidence_id: uuid.UUID,
    ) -> List[ReverseSearchHistoryItem]:
        q = (
            select(ReverseSearchResult)
            .where(
                ReverseSearchResult.case_id == case_id,
                ReverseSearchResult.evidence_id == evidence_id,
            )
            .order_by(desc(ReverseSearchResult.created_at))
        )
        res = await session.execute(q)
        records = res.scalars().all()
        return [
            ReverseSearchHistoryItem(
                id=str(r.id),
                case_id=str(r.case_id),
                evidence_id=str(r.evidence_id),
                provider=r.provider,
                status=SearchStatus(r.status),
                exact_matches_count=r.exact_matches_count,
                visual_matches_count=r.visual_matches_count,
                returned_urls=r.returned_urls,
                created_at=r.created_at,
            )
            for r in records
        ]


_reverse_search_service: ReverseSearchService | None = None


def get_reverse_search_service() -> ReverseSearchService:
    global _reverse_search_service
    if _reverse_search_service is None:
        _reverse_search_service = ReverseSearchService()
    return _reverse_search_service
