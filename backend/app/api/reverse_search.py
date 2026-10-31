"""
ShieldHer – Reverse Image Search & Local Comparison API Endpoints.

ROUTERS:
- GET  /cases/{case_id}/evidence/{evidence_id}/reverse-search/disclosure
- POST /cases/{case_id}/evidence/{evidence_id}/reverse-search
- GET  /cases/{case_id}/evidence/{evidence_id}/reverse-search
- POST /cases/{case_id}/evidence/{evidence_id}/compare-local
- POST /compare/local
"""
from __future__ import annotations

from typing import List, Optional
import uuid
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload
import structlog

from app.database import get_db_session
from app.models.entities import Case, EvidenceItem, User
from app.schemas.reverse_search import (
    ConsentDisclosureResponse,
    LocalComparisonResult,
    ReverseSearchConsent,
    ReverseSearchHistoryItem,
    ReverseSearchResponse,
)
from app.services.auth_service import check_case_ownership_or_permission, get_current_user
from app.services.crypto_service import CryptoService, get_crypto_service
from app.services.local_comparison_service import LocalComparisonService, get_local_comparison_service
from app.services.reverse_search_service import ReverseSearchService, get_reverse_search_service
from app.services.storage_service import ObjectStorageInterface, get_storage_service

logger = structlog.get_logger(__name__)

router = APIRouter(tags=["Reverse Image Search & Perceptual Comparison"])


# ── 1. Consent Disclosure & Search Budget ──────────────────────────────

@router.get(
    "/cases/{case_id}/evidence/{evidence_id}/reverse-search/disclosure",
    response_model=ConsentDisclosureResponse,
    summary="Retrieve consent disclosure and daily search budget status",
)
async def get_search_disclosure(
    case_id: uuid.UUID,
    evidence_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    service: ReverseSearchService = Depends(get_reverse_search_service),
) -> ConsentDisclosureResponse:
    async with get_db_session() as session:
        res = await session.execute(
            select(EvidenceItem).join(Case).where(
                EvidenceItem.id == evidence_id,
                EvidenceItem.case_id == case_id,
            ).options(selectinload(EvidenceItem.case))
        )
        evidence = res.scalar_one_or_none()
        if not evidence:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Evidence item not found")

        check_case_ownership_or_permission(evidence.case, current_user, allow_examiners=True)
        return await service.get_consent_disclosure(evidence.case, evidence)


# ── 2. Execute Reverse Search ──────────────────────────────────────────

@router.post(
    "/cases/{case_id}/evidence/{evidence_id}/reverse-search",
    response_model=ReverseSearchResponse,
    summary="Execute reverse image search with explicit affirmative consent",
)
async def execute_reverse_search(
    case_id: uuid.UUID,
    evidence_id: uuid.UUID,
    consent: ReverseSearchConsent,
    force_refresh: bool = Query(False, description="Bypass cache and force an external API search call"),
    public_image_url: Optional[str] = Query(None, description="Optional public URL override for testing or hosted evidence"),
    current_user: User = Depends(get_current_user),
    service: ReverseSearchService = Depends(get_reverse_search_service),
) -> ReverseSearchResponse:
    async with get_db_session() as session:
        res = await session.execute(
            select(EvidenceItem).join(Case).where(
                EvidenceItem.id == evidence_id,
                EvidenceItem.case_id == case_id,
            ).options(selectinload(EvidenceItem.case))
        )
        evidence = res.scalar_one_or_none()
        if not evidence:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Evidence item not found")

        check_case_ownership_or_permission(evidence.case, current_user, allow_examiners=False)

        return await service.execute_reverse_search(
            session=session,
            case=evidence.case,
            evidence=evidence,
            user=current_user,
            consent=consent,
            force_refresh=force_refresh,
            public_image_url=public_image_url,
        )


# ── 3. List Reverse Search History ─────────────────────────────────────

@router.get(
    "/cases/{case_id}/evidence/{evidence_id}/reverse-search",
    response_model=List[ReverseSearchHistoryItem],
    summary="List reverse search history for evidence item",
)
async def list_reverse_searches(
    case_id: uuid.UUID,
    evidence_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    service: ReverseSearchService = Depends(get_reverse_search_service),
) -> List[ReverseSearchHistoryItem]:
    async with get_db_session() as session:
        res = await session.execute(
            select(EvidenceItem).join(Case).where(
                EvidenceItem.id == evidence_id,
                EvidenceItem.case_id == case_id,
            ).options(selectinload(EvidenceItem.case))
        )
        evidence = res.scalar_one_or_none()
        if not evidence:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Evidence item not found")

        check_case_ownership_or_permission(evidence.case, current_user, allow_examiners=True)
        return await service.list_searches_for_evidence(session, case_id, evidence_id)


# ── 4. Compare Evidence Locally Against Reference Image ────────────────

@router.post(
    "/cases/{case_id}/evidence/{evidence_id}/compare-local",
    response_model=LocalComparisonResult,
    summary="Compare case evidence against an uploaded reference image locally",
)
async def compare_case_evidence_local(
    case_id: uuid.UUID,
    evidence_id: uuid.UUID,
    file_reference: UploadFile = File(..., description="Reference image file for local comparison"),
    current_user: User = Depends(get_current_user),
    crypto: CryptoService = Depends(get_crypto_service),
    storage: ObjectStorageInterface = Depends(get_storage_service),
    local_comp: LocalComparisonService = Depends(get_local_comparison_service),
) -> LocalComparisonResult:
    async with get_db_session() as session:
        res = await session.execute(
            select(EvidenceItem).join(Case).where(
                EvidenceItem.id == evidence_id,
                EvidenceItem.case_id == case_id,
            ).options(selectinload(EvidenceItem.case))
        )
        evidence = res.scalar_one_or_none()
        if not evidence:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Evidence item not found")

        check_case_ownership_or_permission(evidence.case, current_user, allow_examiners=True)

        if evidence.is_deleted or not evidence.storage_key_encrypted_evidence:
            raise HTTPException(status_code=status.HTTP_410_GONE, detail="Evidence item has been purged.")

        # Load and decrypt query image
        enc_bytes = storage.load_file(evidence.storage_key_encrypted_evidence)
        query_bytes = crypto.decrypt_evidence(enc_bytes, evidence.encryption_iv_hex)

    # Read reference bytes
    ref_bytes = await file_reference.read()
    if not ref_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded reference file is empty.")

    return local_comp.compare_images(query_bytes, ref_bytes)


# ── 5. Standalone Local Image Comparison ───────────────────────────────

@router.post(
    "/compare/local",
    response_model=LocalComparisonResult,
    summary="Perform local cryptographic & perceptual comparison between two uploaded images",
)
async def compare_two_images_local(
    file_query: UploadFile = File(..., description="Query image file"),
    file_reference: UploadFile = File(..., description="Reference image file"),
    local_comp: LocalComparisonService = Depends(get_local_comparison_service),
) -> LocalComparisonResult:
    query_bytes = await file_query.read()
    ref_bytes = await file_reference.read()

    if not query_bytes or not ref_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Both query and reference image files must be provided and non-empty.",
        )

    return local_comp.compare_images(query_bytes, ref_bytes)
