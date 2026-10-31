"""
ShieldHer – Schemas for Reverse Image Search & Perceptual Comparison.

Distinguishes:
1. Exact indexed matches vs. visual resemblance matches from Google Lens.
2. Local cryptographic (SHA-256) vs. perceptual hash (pHash, aHash, dHash) comparisons.
3. Informed consent disclosure payloads prior to external image transmission.
"""
from __future__ import annotations

import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class SearchStatus(str, Enum):
    SUCCESS = "SUCCESS"
    NO_MATCHES_FOUND = "NO_MATCHES_FOUND"
    RATE_LIMITED = "RATE_LIMITED"
    QUOTA_EXCEEDED = "QUOTA_EXCEEDED"
    UNAVAILABLE = "UNAVAILABLE"
    TIMEOUT = "TIMEOUT"
    PROCESSING_ERROR = "PROCESSING_ERROR"


class MatchCategory(str, Enum):
    EXACT_MATCH = "EXACT_MATCH"
    VISUALLY_SIMILAR = "VISUALLY_SIMILAR"


class LocalMatchCategory(str, Enum):
    EXACT_BYTE_MATCH = "EXACT_BYTE_MATCH"
    EXACT_PERCEPTUAL_MATCH = "EXACT_PERCEPTUAL_MATCH"
    HIGH_VISUAL_SIMILARITY = "HIGH_VISUAL_SIMILARITY"
    MODERATE_VISUAL_SIMILARITY = "MODERATE_VISUAL_SIMILARITY"
    LOW_SIMILARITY = "LOW_SIMILARITY"
    NO_SIMILARITY = "NO_SIMILARITY"


# ── Consent & Disclosure ───────────────────────────────────────────────

class ReverseSearchConsent(BaseModel):
    consent_to_external_search: bool = Field(
        ...,
        description="Affirmative informed consent to transfer this image query to the external search provider.",
    )
    acknowledged_provider: str = Field(
        "SerpApi Google Lens",
        description="The external provider identified by the user as authorized to process the search query.",
    )
    notes: Optional[str] = Field(
        None,
        description="Optional justification or examiner notes for audit logging.",
    )


class ConsentDisclosureResponse(BaseModel):
    evidence_id: str
    filename_sanitized: str
    original_sha256: str
    target_provider: str = "SerpApi (Google Lens API, engine=google_lens)"
    image_representation_sent: str = "Normalized image representation (stripped of EXIF metadata and original filesystem attributes)"
    external_provider_privacy_notice: str = (
        "Performing reverse image search sends the image query outside ShieldHer's encrypted boundary "
        "to SerpApi and Google Lens. The external provider may log the query, process visual features, "
        "and query public web indices. Never transmit imagery if the risk of third-party exposure "
        "exceeds investigatory necessity."
    )
    daily_budget_remaining: int
    daily_budget_limit: int
    can_search: bool


# ── Match Items & Search Results ───────────────────────────────────────

class SearchMatchItem(BaseModel):
    position: int
    title: str
    link: str
    source: Optional[str] = None
    thumbnail: Optional[str] = None
    is_exact_match: bool = Field(
        ...,
        description="True if Google Lens identified an exact or identical image match; False for visually similar matches.",
    )
    match_category: MatchCategory
    notes: Optional[str] = None


class ReverseSearchResponse(BaseModel):
    search_id: Optional[str] = None
    case_id: str
    evidence_id: str
    status: SearchStatus
    provider: str = "SerpApi Google Lens"
    search_timestamp: datetime.datetime
    duration_ms: Optional[float] = None
    query_image_sha256: str
    query_phash: Optional[str] = None
    exact_matches_count: int = 0
    visual_matches_count: int = 0
    exact_matches: List[SearchMatchItem] = Field(default_factory=list)
    visual_matches: List[SearchMatchItem] = Field(default_factory=list)
    returned_urls: List[str] = Field(default_factory=list)
    budget_remaining: int
    explanation: str
    disclaimer: str = (
        "CRITICAL NOTICE: Google Lens index searches reflect publicly crawled internet pages. "
        "A lack of search results DOES NOT prove that an image has never been disseminated online; "
        "private messaging services, paywalled websites, and unindexed platforms are not covered. "
        "Conversely, visual matches denote algorithmic visual similarity and do not establish "
        "that the depicted subject or source is identical."
    )


class ReverseSearchHistoryItem(BaseModel):
    id: str
    case_id: str
    evidence_id: str
    provider: str
    status: SearchStatus
    exact_matches_count: int
    visual_matches_count: int
    returned_urls: List[str]
    created_at: datetime.datetime


# ── Local Perceptual & Cryptographic Comparison ────────────────────────

class LocalComparisonResult(BaseModel):
    query_sha256: str
    reference_sha256: str
    is_exact_sha256_match: bool = Field(
        ...,
        description="True only if images have identical bit-for-bit SHA-256 digests.",
    )
    query_phash: str
    reference_phash: str
    hamming_distance: int = Field(
        ...,
        description="Hamming distance between 64-bit DCT perceptual hashes (0 = identical perceptual structure, 64 = completely different).",
    )
    visual_similarity_score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Normalized perceptual similarity score: (64 - hamming_distance) / 64.0.",
    )
    match_category: LocalMatchCategory
    details: Dict[str, Any] = Field(default_factory=dict)
    disclaimer: str = (
        "DISCLAIMER: Perceptual hash comparisons evaluate mathematical visual resemblance under compression, "
        "resizing, or minor color grading. A close perceptual match DOES NOT prove shared origin, identical "
        "camera sensor provenance, or common authorship."
    )
