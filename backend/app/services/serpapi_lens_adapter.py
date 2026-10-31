"""
ShieldHer – SerpApi Google Lens Provider Adapter.

Official Documentation: https://serpapi.com/google-lens-api
Target Engine: `engine="google_lens"`

RESPONSIBILITIES & CONSTRAINTS:
1. Keeps all API credentials on the server (never exposed to client).
2. Connects exclusively via official SerpApi endpoints without scraping social media
   or bypassing platform access controls.
3. Distinguishes `exact_matches` (identical image index entries) from `visual_matches`
   (algorithmic visual similarity).
4. Handles network timeouts, API rate limits, quota exhaustion, and service unavailability.
5. Emphasizes that 0 returned matches NEVER implies the image has not appeared online.
"""
from __future__ import annotations

import datetime
import time
from typing import Any, Dict, List, Optional
import httpx
import structlog

from app.config import get_settings
from app.schemas.reverse_search import (
    MatchCategory,
    SearchMatchItem,
    SearchStatus,
)

logger = structlog.get_logger(__name__)


class ProviderSearchOutput:
    """Internal adapter result representation."""
    def __init__(
        self,
        status: SearchStatus,
        provider: str = "SerpApi Google Lens",
        exact_matches: Optional[List[SearchMatchItem]] = None,
        visual_matches: Optional[List[SearchMatchItem]] = None,
        returned_urls: Optional[List[str]] = None,
        search_duration_ms: Optional[float] = None,
        search_timestamp: Optional[datetime.datetime] = None,
        explanation: str = "",
        raw_error: Optional[str] = None,
    ):
        self.status = status
        self.provider = provider
        self.exact_matches = exact_matches or []
        self.visual_matches = visual_matches or []
        self.returned_urls = returned_urls or []
        self.search_duration_ms = search_duration_ms
        self.search_timestamp = search_timestamp or datetime.datetime.now(datetime.timezone.utc)
        self.explanation = explanation
        self.raw_error = raw_error


_SENTINEL = object()


class SerpApiGoogleLensAdapter:
    """Adapter for SerpApi's Google Lens reverse-image search engine."""

    def __init__(
        self,
        api_key: Any = _SENTINEL,
        base_url: Optional[str] = None,
        timeout: Optional[float] = None,
    ):
        settings = get_settings()
        self.api_key = settings.serpapi_api_key if api_key is _SENTINEL else api_key
        self.base_url = base_url or settings.serpapi_base_url
        self.timeout = timeout or settings.reverse_search_timeout_seconds

    @property
    def is_configured(self) -> bool:
        """Returns True if a non-empty SerpApi key is present."""
        return bool(self.api_key and self.api_key.strip())

    async def search(
        self,
        image_url: Optional[str] = None,
        search_type: str = "all",
        language: str = "en",
        country: Optional[str] = None,
        client: Optional[httpx.AsyncClient] = None,
    ) -> ProviderSearchOutput:
        """
        Executes a reverse-image search via SerpApi Google Lens.

        Parameters:
        - image_url: Publicly accessible URL of the target image derivative.
        - search_type: 'all', 'visual_matches', or 'exact_matches'.
        - language: Search language code (default 'en').
        - country: Optional geolocation parameter (e.g. 'us').
        - client: Optional injected httpx.AsyncClient (for testing).
        """
        start_time = time.perf_counter()
        now_utc = datetime.datetime.now(datetime.timezone.utc)

        # 1. Check configuration
        if not self.is_configured:
            logger.warning("SerpApi API key not configured; reverse search unavailable")
            return ProviderSearchOutput(
                status=SearchStatus.UNAVAILABLE,
                search_timestamp=now_utc,
                explanation="SerpApi API key is not configured on the server. External reverse search is disabled.",
                raw_error="SERPAPI_API_KEY missing",
            )

        if not image_url:
            return ProviderSearchOutput(
                status=SearchStatus.PROCESSING_ERROR,
                search_timestamp=now_utc,
                explanation="No public image URL was provided for Google Lens search.",
                raw_error="Missing image_url parameter",
            )

        params: Dict[str, Any] = {
            "engine": "google_lens",
            "api_key": self.api_key,
            "url": image_url,
            "hl": language,
            "type": search_type,
        }
        if country:
            params["country"] = country

        should_close_client = False
        if client is None:
            client = httpx.AsyncClient(timeout=self.timeout)
            should_close_client = True

        try:
            logger.info("Dispatching external reverse image search to SerpApi", engine="google_lens")
            response = await client.get(self.base_url, params=params)
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)

            # 2. Handle HTTP Status codes
            if response.status_code == 429:
                return ProviderSearchOutput(
                    status=SearchStatus.RATE_LIMITED,
                    search_duration_ms=duration_ms,
                    search_timestamp=now_utc,
                    explanation="External search provider rate limit exceeded. Please retry later.",
                    raw_error="HTTP 429 Rate Limited",
                )

            if response.status_code in (401, 403):
                return ProviderSearchOutput(
                    status=SearchStatus.PROCESSING_ERROR,
                    search_duration_ms=duration_ms,
                    search_timestamp=now_utc,
                    explanation="Authentication with the external search provider failed. Verify API credentials.",
                    raw_error=f"HTTP {response.status_code} Unauthorized/Forbidden",
                )

            if response.status_code >= 500:
                return ProviderSearchOutput(
                    status=SearchStatus.UNAVAILABLE,
                    search_duration_ms=duration_ms,
                    search_timestamp=now_utc,
                    explanation="External search provider is temporarily unavailable. Please retry later.",
                    raw_error=f"HTTP {response.status_code} Server Error",
                )

            data = response.json()

            # 3. Check for SerpApi error envelope
            if "error" in data:
                err_msg = str(data["error"])
                if "run out of searches" in err_msg.lower() or "quota" in err_msg.lower():
                    status = SearchStatus.QUOTA_EXCEEDED
                    expl = "SerpApi search quota has been exhausted. External reverse search cannot proceed."
                else:
                    status = SearchStatus.PROCESSING_ERROR
                    expl = f"SerpApi returned an error: {err_msg}"
                return ProviderSearchOutput(
                    status=status,
                    search_duration_ms=duration_ms,
                    search_timestamp=now_utc,
                    explanation=expl,
                    raw_error=err_msg,
                )

            # 4. Parse exact and visual matches distinctly
            raw_exact = data.get("exact_matches", [])
            raw_visual = data.get("visual_matches", [])

            exact_items: List[SearchMatchItem] = []
            visual_items: List[SearchMatchItem] = []
            returned_urls: List[str] = []

            for idx, item in enumerate(raw_exact, start=1):
                link = item.get("link") or ""
                if link:
                    returned_urls.append(link)
                exact_items.append(
                    SearchMatchItem(
                        position=item.get("position", idx),
                        title=item.get("title", "Untitled Match"),
                        link=link,
                        source=item.get("source"),
                        thumbnail=item.get("thumbnail"),
                        is_exact_match=True,
                        match_category=MatchCategory.EXACT_MATCH,
                        notes="Identified by Google Lens as an exact match to the uploaded imagery.",
                    )
                )

            for idx, item in enumerate(raw_visual, start=1):
                link = item.get("link") or ""
                if link:
                    returned_urls.append(link)
                visual_items.append(
                    SearchMatchItem(
                        position=item.get("position", idx),
                        title=item.get("title", "Untitled Visual Match"),
                        link=link,
                        source=item.get("source"),
                        thumbnail=item.get("thumbnail"),
                        is_exact_match=False,
                        match_category=MatchCategory.VISUALLY_SIMILAR,
                        notes="Identified by Google Lens as visually or stylistically similar. Does not prove identical source.",
                    )
                )

            total_matches = len(exact_items) + len(visual_items)

            if total_matches == 0:
                status = SearchStatus.NO_MATCHES_FOUND
                explanation = (
                    "No public web matches were discovered by Google Lens. This does NOT prove that "
                    "the image has never appeared online; unindexed websites, private messaging channels, "
                    "paywalled forums, and restricted social platforms are not covered by public search indices."
                )
            else:
                status = SearchStatus.SUCCESS
                explanation = (
                    f"Discovered {len(exact_items)} exact matches and {len(visual_items)} visually similar "
                    f"matches via Google Lens."
                )

            return ProviderSearchOutput(
                status=status,
                provider="SerpApi Google Lens",
                exact_matches=exact_items,
                visual_matches=visual_items,
                returned_urls=returned_urls,
                search_duration_ms=duration_ms,
                search_timestamp=now_utc,
                explanation=explanation,
            )

        except httpx.TimeoutException:
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
            logger.warning("SerpApi Google Lens request timed out", timeout=self.timeout)
            return ProviderSearchOutput(
                status=SearchStatus.TIMEOUT,
                search_duration_ms=duration_ms,
                search_timestamp=now_utc,
                explanation=f"Reverse search timed out after {self.timeout}s waiting for external provider response.",
                raw_error="TimeoutException",
            )
        except Exception as exc:
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
            logger.error("Unexpected error during SerpApi reverse image search", error=str(exc))
            return ProviderSearchOutput(
                status=SearchStatus.PROCESSING_ERROR,
                search_duration_ms=duration_ms,
                search_timestamp=now_utc,
                explanation=f"Error executing reverse search: {str(exc)}",
                raw_error=str(exc),
            )
        finally:
            if should_close_client:
                await client.aclose()


_serpapi_adapter: SerpApiGoogleLensAdapter | None = None


def get_serpapi_adapter() -> SerpApiGoogleLensAdapter:
    global _serpapi_adapter
    if _serpapi_adapter is None:
        _serpapi_adapter = SerpApiGoogleLensAdapter()
    return _serpapi_adapter
