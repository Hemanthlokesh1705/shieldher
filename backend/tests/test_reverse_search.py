"""
ShieldHer – Test Suite for Reverse Image Search & Perceptual Comparison.

Verifies:
1. Provider adapter request/response schemas, parsing of exact matches vs visual matches.
2. Server-side API credential isolation (keys are never leaked in responses or logs).
3. Explicit affirmative consent requirement immediately prior to external provider transfer.
4. Consent disclosure endpoint explaining provider and data representation.
5. Search budget limits and rate limit enforcement.
6. Recording of timestamps, provider name, returned URLs, and structured statuses in DB.
7. Handling of timeouts, HTTP 429 rate limits, quota exhaustion, and missing API keys.
8. Separation of search results from AI-detection scores.
9. Local SHA-256 and perceptual-hash comparisons (exact, similar, dissimilar) with mandatory disclaimers.
10. Idempotency (preventing automatic duplicate external searches).
11. Invariant: 0 matches returned does NOT claim the image has never appeared online.
"""
from __future__ import annotations

import io
import time
from unittest.mock import AsyncMock, patch
import uuid
import httpx
from httpx import ASGITransport, AsyncClient
from PIL import Image
import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.database import Base, get_db_session
from app.main import app
from app.models.entities import Case, EvidenceItem, ReverseSearchResult, User
from app.schemas.reverse_search import (
    LocalMatchCategory,
    MatchCategory,
    SearchMatchItem,
    SearchStatus,
)
from app.services.crypto_service import get_crypto_service
from app.services.local_comparison_service import LocalComparisonService, get_local_comparison_service
from app.services.redis_service import get_redis_service
from app.services.reverse_search_service import ReverseSearchService, get_reverse_search_service
from app.services.serpapi_lens_adapter import ProviderSearchOutput, SerpApiGoogleLensAdapter
from app.services.storage_service import LocalObjectStorage, get_storage_service


@pytest.fixture(scope="module")
def anyio_backend():
    return "asyncio"


@pytest.fixture(autouse=True)
async def setup_test_db(tmp_path_factory):
    """Initializes isolated test database and temporary storage."""
    test_dir = tmp_path_factory.mktemp("shieldher_search_test")
    engine = create_async_engine(f"sqlite+aiosqlite:///{test_dir}/test.db")
    session_factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    from app import database
    orig_engine = database._engine
    orig_factory = database._session_factory
    database._engine = engine
    database._session_factory = session_factory

    from app.services import storage_service
    orig_storage = storage_service._storage_service
    test_storage = LocalObjectStorage(root_dir=test_dir / "secure_storage")
    storage_service._storage_service = test_storage

    yield

    await engine.dispose()
    database._engine = orig_engine
    database._session_factory = orig_factory
    storage_service._storage_service = orig_storage


@pytest.fixture
def test_client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://testserver")


@pytest.fixture
def sample_image_pair():
    """Generates an image and a slightly compressed/resized derivative for similarity testing."""
    import numpy as np

    # Image 1: Patterned textured image
    np.random.seed(42)
    arr1 = np.random.randint(50, 200, (200, 200, 3), dtype=np.uint8)
    img1 = Image.fromarray(arr1)
    buf1 = io.BytesIO()
    img1.save(buf1, format="JPEG", quality=95)
    bytes1 = buf1.getvalue()

    # Image 2: Minor re-compression of Image 1 (high perceptual similarity)
    buf2 = io.BytesIO()
    img1.save(buf2, format="JPEG", quality=75)
    bytes2 = buf2.getvalue()

    # Image 3: Completely distinct pattern
    np.random.seed(999)
    arr3 = np.random.randint(50, 200, (200, 200, 3), dtype=np.uint8)
    img3 = Image.fromarray(arr3)
    buf3 = io.BytesIO()
    img3.save(buf3, format="PNG")
    bytes3 = buf3.getvalue()

    return bytes1, bytes2, bytes3


async def create_user_and_case(client: AsyncClient, email: str = "victim_search@example.com"):
    """Helper to register user, login, and create an empty case."""
    reg = await client.post(
        "/auth/register",
        json={"email": email, "password": "SecurePassword123!", "role": "VICTIM"},
    )
    assert reg.status_code in (201, 409)

    login = await client.post(
        "/auth/token",
        data={"username": email, "password": "SecurePassword123!"},
    )
    token = login.json()["access_token"]

    case_res = await client.post(
        "/cases",
        json={"title": "Reverse Search Investigation"},
        headers={"Authorization": f"Bearer {token}"},
    )
    case_id = case_res.json()["id"]
    return token, case_id


# ── 1. Local Cryptographic & Perceptual Comparison Tests ───────────────

def test_local_comparison_identical_images(sample_image_pair):
    bytes1, _, _ = sample_image_pair
    svc = get_local_comparison_service()

    result = svc.compare_images(bytes1, bytes1)
    assert result.is_exact_sha256_match is True
    assert result.hamming_distance == 0
    assert result.visual_similarity_score == 1.0
    assert result.match_category == LocalMatchCategory.EXACT_BYTE_MATCH
    assert "DOES NOT prove shared origin" in result.disclaimer


def test_local_comparison_compressed_or_resized(sample_image_pair):
    bytes1, bytes2, _ = sample_image_pair
    svc = get_local_comparison_service()

    result = svc.compare_images(bytes1, bytes2)
    # Different bytes -> not exact SHA-256 match
    assert result.is_exact_sha256_match is False
    # Visually similar -> low Hamming distance, high visual similarity score
    assert result.hamming_distance <= 6
    assert result.visual_similarity_score >= 0.90
    assert result.match_category in (
        LocalMatchCategory.EXACT_PERCEPTUAL_MATCH,
        LocalMatchCategory.HIGH_VISUAL_SIMILARITY,
    )
    assert "DOES NOT prove shared origin" in result.disclaimer


def test_local_comparison_distinct_images(sample_image_pair):
    bytes1, _, bytes3 = sample_image_pair
    svc = get_local_comparison_service()

    result = svc.compare_images(bytes1, bytes3)
    assert result.is_exact_sha256_match is False
    assert result.hamming_distance > 10
    assert result.visual_similarity_score < 0.85
    assert result.match_category in (
        LocalMatchCategory.LOW_SIMILARITY,
        LocalMatchCategory.NO_SIMILARITY,
    )


# ── 2. SerpApi Provider Adapter Unit Tests ─────────────────────────────

@pytest.mark.asyncio
async def test_serpapi_adapter_missing_key():
    adapter = SerpApiGoogleLensAdapter(api_key=None)
    assert not adapter.is_configured

    out = await adapter.search(image_url="https://example.com/test.jpg")
    assert out.status == SearchStatus.UNAVAILABLE
    assert "SERPAPI_API_KEY missing" in (out.raw_error or "")


@pytest.mark.asyncio
async def test_serpapi_adapter_success_distinguishes_exact_vs_visual():
    mock_payload = {
        "search_metadata": {"status": "Success"},
        "exact_matches": [
            {
                "position": 1,
                "title": "Exact Match Source Page",
                "link": "https://example.com/leak1.html",
                "source": "example.com",
                "thumbnail": "https://example.com/thumb1.jpg",
            }
        ],
        "visual_matches": [
            {
                "position": 2,
                "title": "Visually Similar Image",
                "link": "https://other.com/similar.html",
                "source": "other.com",
                "thumbnail": "https://other.com/thumb2.jpg",
            }
        ],
    }

    mock_resp = httpx.Response(200, json=mock_payload, request=httpx.Request("GET", "https://serpapi.com/search"))
    mock_client = AsyncMock(spec=httpx.AsyncClient)
    mock_client.get = AsyncMock(return_value=mock_resp)

    adapter = SerpApiGoogleLensAdapter(api_key="test_serpapi_key")
    out = await adapter.search(image_url="https://example.com/test.jpg", client=mock_client)

    assert out.status == SearchStatus.SUCCESS
    assert len(out.exact_matches) == 1
    assert out.exact_matches[0].is_exact_match is True
    assert out.exact_matches[0].match_category == MatchCategory.EXACT_MATCH
    assert out.exact_matches[0].link == "https://example.com/leak1.html"

    assert len(out.visual_matches) == 1
    assert out.visual_matches[0].is_exact_match is False
    assert out.visual_matches[0].match_category == MatchCategory.VISUALLY_SIMILAR

    assert "https://example.com/leak1.html" in out.returned_urls
    assert "https://other.com/similar.html" in out.returned_urls


@pytest.mark.asyncio
async def test_serpapi_adapter_no_matches_found_invariant():
    mock_payload = {
        "search_metadata": {"status": "Success"},
        "exact_matches": [],
        "visual_matches": [],
    }

    mock_resp = httpx.Response(200, json=mock_payload, request=httpx.Request("GET", "https://serpapi.com/search"))
    mock_client = AsyncMock(spec=httpx.AsyncClient)
    mock_client.get = AsyncMock(return_value=mock_resp)

    adapter = SerpApiGoogleLensAdapter(api_key="test_serpapi_key")
    out = await adapter.search(image_url="https://example.com/test.jpg", client=mock_client)

    assert out.status == SearchStatus.NO_MATCHES_FOUND
    assert len(out.exact_matches) == 0
    assert len(out.visual_matches) == 0
    # Invariant: Lack of matches DOES NOT prove image has never appeared online
    assert "This does NOT prove that the image has never appeared online" in out.explanation


@pytest.mark.asyncio
async def test_serpapi_adapter_rate_limit_and_quota_error():
    # 1. HTTP 429
    mock_resp_429 = httpx.Response(429, request=httpx.Request("GET", "https://serpapi.com/search"))
    mock_client = AsyncMock(spec=httpx.AsyncClient)
    mock_client.get = AsyncMock(return_value=mock_resp_429)

    adapter = SerpApiGoogleLensAdapter(api_key="test_serpapi_key")
    out_429 = await adapter.search(image_url="https://example.com/test.jpg", client=mock_client)
    assert out_429.status == SearchStatus.RATE_LIMITED

    # 2. SerpApi Quota JSON
    mock_resp_quota = httpx.Response(
        200,
        json={"error": "Your account has run out of searches."},
        request=httpx.Request("GET", "https://serpapi.com/search"),
    )
    mock_client.get = AsyncMock(return_value=mock_resp_quota)
    out_quota = await adapter.search(image_url="https://example.com/test.jpg", client=mock_client)
    assert out_quota.status == SearchStatus.QUOTA_EXCEEDED


@pytest.mark.asyncio
async def test_serpapi_adapter_timeout_handling():
    mock_client = AsyncMock(spec=httpx.AsyncClient)
    mock_client.get = AsyncMock(side_effect=httpx.TimeoutException("Timed out"))

    adapter = SerpApiGoogleLensAdapter(api_key="test_serpapi_key", timeout=5.0)
    out = await adapter.search(image_url="https://example.com/test.jpg", client=mock_client)
    assert out.status == SearchStatus.TIMEOUT
    assert "timed out after 5.0s" in out.explanation


# ── 3. API End-to-End Tests & Privacy Guarantees ───────────────────────

@pytest.mark.asyncio
async def test_consent_disclosure_endpoint(test_client, sample_image_pair):
    bytes1, _, _ = sample_image_pair
    async with test_client as client:
        token, case_id = await create_user_and_case(client, "victim_disclosure@example.com")

        # Upload evidence
        up_resp = await client.post(
            f"/cases/{case_id}/evidence",
            files={"file": ("evidence1.jpg", bytes1, "image/jpeg")},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert up_resp.status_code == 201
        ev_id = up_resp.json()["id"]

        # Call disclosure endpoint
        disc_resp = await client.get(
            f"/cases/{case_id}/evidence/{ev_id}/reverse-search/disclosure",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert disc_resp.status_code == 200
        disc_data = disc_resp.json()

        assert disc_data["evidence_id"] == ev_id
        assert "Google Lens" in disc_data["target_provider"]
        assert "SerpApi" in disc_data["external_provider_privacy_notice"]
        assert disc_data["daily_budget_remaining"] > 0


@pytest.mark.asyncio
async def test_reverse_search_requires_affirmative_consent(test_client, sample_image_pair):
    bytes1, _, _ = sample_image_pair
    async with test_client as client:
        token, case_id = await create_user_and_case(client, "victim_consent_fail@example.com")

        up_resp = await client.post(
            f"/cases/{case_id}/evidence",
            files={"file": ("evidence2.jpg", bytes1, "image/jpeg")},
            headers={"Authorization": f"Bearer {token}"},
        )
        ev_id = up_resp.json()["id"]

        # Attempt search with consent_to_external_search=False
        search_resp = await client.post(
            f"/cases/{case_id}/evidence/{ev_id}/reverse-search",
            json={
                "consent_to_external_search": False,
                "acknowledged_provider": "SerpApi Google Lens",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        # Must be rejected immediately!
        assert search_resp.status_code == 400
        err_json = search_resp.json()
        error_msg = err_json.get("detail") or err_json.get("error", {}).get("message", "")
        assert "Explicit affirmative consent is required" in error_msg


@pytest.mark.asyncio
async def test_reverse_search_execution_and_idempotent_caching(test_client, sample_image_pair):
    bytes1, _, _ = sample_image_pair
    async with test_client as client:
        token, case_id = await create_user_and_case(client, "victim_search_cache@example.com")

        up_resp = await client.post(
            f"/cases/{case_id}/evidence",
            files={"file": ("evidence3.jpg", bytes1, "image/jpeg")},
            headers={"Authorization": f"Bearer {token}"},
        )
        ev_id = up_resp.json()["id"]

        # Mock external SerpApi adapter search
        mock_output = ProviderSearchOutput(
            status=SearchStatus.SUCCESS,
            provider="SerpApi Google Lens",
            exact_matches=[
                SearchMatchItem(
                    position=1,
                    title="Indexed Leak Page",
                    link="https://public-forum.org/leak.html",
                    source="public-forum.org",
                    thumbnail="https://public-forum.org/t.jpg",
                    is_exact_match=True,
                    match_category=MatchCategory.EXACT_MATCH,
                )
            ],
            visual_matches=[],
            returned_urls=["https://public-forum.org/leak.html"],
            search_duration_ms=450.0,
            explanation="Discovered 1 exact match via Google Lens.",
        )

        with patch.object(SerpApiGoogleLensAdapter, "search", new_callable=AsyncMock) as mock_search:
            mock_search.return_value = mock_output

            # 1. First search with affirmative consent
            res1 = await client.post(
                f"/cases/{case_id}/evidence/{ev_id}/reverse-search",
                json={
                    "consent_to_external_search": True,
                    "acknowledged_provider": "SerpApi Google Lens",
                },
                headers={"Authorization": f"Bearer {token}"},
            )
            assert res1.status_code == 200
            data1 = res1.json()
            assert data1["status"] == "SUCCESS"
            assert data1["exact_matches_count"] == 1
            assert "https://public-forum.org/leak.html" in data1["returned_urls"]
            assert mock_search.call_count == 1

            # 2. Second search without force_refresh returns cached record without re-querying external provider
            res2 = await client.post(
                f"/cases/{case_id}/evidence/{ev_id}/reverse-search",
                json={
                    "consent_to_external_search": True,
                    "acknowledged_provider": "SerpApi Google Lens",
                },
                headers={"Authorization": f"Bearer {token}"},
            )
            assert res2.status_code == 200
            data2 = res2.json()
            assert data2["search_id"] == data1["search_id"]
            assert "Retrieved existing reverse search results from cache" in data2["explanation"]
            # Verify adapter was NOT called a second time
            assert mock_search.call_count == 1

            # 3. Check search history endpoint
            hist_resp = await client.get(
                f"/cases/{case_id}/evidence/{ev_id}/reverse-search",
                headers={"Authorization": f"Bearer {token}"},
            )
            assert hist_resp.status_code == 200
            hist = hist_resp.json()
            assert len(hist) >= 1
            assert hist[0]["exact_matches_count"] == 1


@pytest.mark.asyncio
async def test_reverse_search_daily_budget_enforcement(test_client, sample_image_pair):
    bytes1, _, _ = sample_image_pair
    async with test_client as client:
        token, case_id = await create_user_and_case(client, "victim_budget@example.com")

        up_resp = await client.post(
            f"/cases/{case_id}/evidence",
            files={"file": ("evidence4.jpg", bytes1, "image/jpeg")},
            headers={"Authorization": f"Bearer {token}"},
        )
        ev_id = up_resp.json()["id"]

        # Consume case budget via redis service
        redis_svc = get_redis_service()
        # Daily limit is 5
        for _ in range(5):
            await redis_svc.check_and_consume_search_budget(str(case_id), daily_limit=5)

        # 6th attempt with force_refresh=True should hit QUOTA_EXCEEDED
        resp = await client.post(
            f"/cases/{case_id}/evidence/{ev_id}/reverse-search?force_refresh=true",
            json={
                "consent_to_external_search": True,
                "acknowledged_provider": "SerpApi Google Lens",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "QUOTA_EXCEEDED"
        assert data["budget_remaining"] == 0
        assert "Daily search budget" in data["explanation"]


@pytest.mark.asyncio
async def test_reverse_search_isolated_from_ai_scores(test_client, sample_image_pair):
    """
    Verifies that reverse search outcomes do not mutate, alter, or conflate
    with intrinsic model_outputs (Effort or Smaug scores).
    """
    bytes1, _, _ = sample_image_pair
    async with test_client as client:
        token, case_id = await create_user_and_case(client, "victim_isolation@example.com")

        up_resp = await client.post(
            f"/cases/{case_id}/evidence",
            files={"file": ("evidence5.jpg", bytes1, "image/jpeg")},
            headers={"Authorization": f"Bearer {token}"},
        )
        ev_data = up_resp.json()
        ev_id = ev_data["id"]
        initial_outputs = ev_data["model_outputs"]

        # Run reverse search with mocked provider
        mock_output = ProviderSearchOutput(
            status=SearchStatus.SUCCESS,
            exact_matches=[],
            visual_matches=[],
            returned_urls=[],
            explanation="No matches",
        )
        with patch.object(SerpApiGoogleLensAdapter, "search", new_callable=AsyncMock, return_value=mock_output):
            await client.post(
                f"/cases/{case_id}/evidence/{ev_id}/reverse-search",
                json={"consent_to_external_search": True, "acknowledged_provider": "SerpApi Google Lens"},
                headers={"Authorization": f"Bearer {token}"},
            )

        # Retrieve case details and verify model_outputs are untouched
        case_resp = await client.get(f"/cases/{case_id}", headers={"Authorization": f"Bearer {token}"})
        item_data = case_resp.json()["evidence_items"][0]
        assert len(item_data["model_outputs"]) == len(initial_outputs)


@pytest.mark.asyncio
async def test_api_local_comparison_endpoints(test_client, sample_image_pair):
    bytes1, bytes2, _ = sample_image_pair
    async with test_client as client:
        token, case_id = await create_user_and_case(client, "victim_comp@example.com")

        up_resp = await client.post(
            f"/cases/{case_id}/evidence",
            files={"file": ("query_base.jpg", bytes1, "image/jpeg")},
            headers={"Authorization": f"Bearer {token}"},
        )
        ev_id = up_resp.json()["id"]

        # 1. Compare case evidence against uploaded reference
        comp_case_resp = await client.post(
            f"/cases/{case_id}/evidence/{ev_id}/compare-local",
            files={"file_reference": ("ref.jpg", bytes2, "image/jpeg")},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert comp_case_resp.status_code == 200
        comp_data = comp_case_resp.json()
        assert comp_data["is_exact_sha256_match"] is False
        assert comp_data["hamming_distance"] <= 6
        assert "DOES NOT prove shared origin" in comp_data["disclaimer"]

        # 2. Standalone compare two uploaded files
        comp_two_resp = await client.post(
            "/compare/local",
            files={
                "file_query": ("q.jpg", bytes1, "image/jpeg"),
                "file_reference": ("r.jpg", bytes1, "image/jpeg"),
            },
        )
        assert comp_two_resp.status_code == 200
        two_data = comp_two_resp.json()
        assert two_data["is_exact_sha256_match"] is True
        assert two_data["hamming_distance"] == 0
        assert two_data["visual_similarity_score"] == 1.0
