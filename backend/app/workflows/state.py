"""
ShieldHer – LangGraph Workflow State Definitions.

Defines the TypedDict `ImageState` and evidence-oriented status enums
for orchestrating privacy-first image forensics and victim support.
"""
from __future__ import annotations

import operator
from enum import Enum
from typing import Annotated, Any, Dict, List, Optional
from typing_extensions import TypedDict


class EvidenceWorkflowStatus(str, Enum):
    """
    Evidence-oriented workflow states.
    CRITICAL FORENSIC PRINCIPLE:
    Detectors returning low scores must NEVER result in an AUTHENTIC verdict.
    Absence of detected manipulation is legally and scientifically INCONCLUSIVE.
    """
    PENDING = "PENDING"
    INSUFFICIENT_IMAGE_QUALITY = "INSUFFICIENT_IMAGE_QUALITY"
    UNSUPPORTED_INPUT = "UNSUPPORTED_INPUT"
    POSSIBLE_FACE_MANIPULATION = "POSSIBLE_FACE_MANIPULATION"
    POSSIBLE_AI_GENERATION = "POSSIBLE_AI_GENERATION"
    POSSIBLE_COMBINED_MANIPULATION = "POSSIBLE_COMBINED_MANIPULATION"
    CONFLICTING_MODEL_RESULTS = "CONFLICTING_MODEL_RESULTS"
    INCONCLUSIVE = "INCONCLUSIVE"
    PROCESSING_ERROR = "PROCESSING_ERROR"


class HumanReviewDecision(str, Enum):
    UNREVIEWED = "UNREVIEWED"
    CONFIRMED_FORGERY = "CONFIRMED_FORGERY"
    SUSPECTED_SYNTHESIS = "SUSPECTED_SYNTHESIS"
    BENIGN_MEDIA = "BENIGN_MEDIA"
    ADDITIONAL_EXAMINATION_REQUIRED = "ADDITIONAL_EXAMINATION_REQUIRED"


class ImageState(TypedDict, total=False):
    """
    Unified state representation passed across LangGraph nodes.
    Supports parallel fan-out/fan-in with reducers for error and audit logs.
    """
    # ── Identifiers & Session ──────────────────────────────────────────
    case_id: str
    session_id: str

    # ── Media references & custody ────────────────────────────────────
    image_hash: Optional[str]  # SHA-256
    storage_reference: Optional[str]  # Storage path to preserved original
    raw_bytes: Optional[bytes]  # Upload byte stream (transient)
    filename: Optional[str]
    content_type: Optional[str]
    detected_format: Optional[str]

    # ── User consent & permissions ────────────────────────────────────
    consent_flags: Dict[str, bool]

    # ── Gateway, detection & assessment ───────────────────────────────
    upload_validation: Optional[Dict[str, Any]]
    face_detection: Optional[Dict[str, Any]]
    quality_assessment: Optional[Dict[str, Any]]

    # ── Pretrained Model Inference (Independent) ───────────────────────
    face_manipulation_result: Optional[Dict[str, Any]]  # EFFORT (FaceForensics++)
    ai_generation_result: Optional[Dict[str, Any]]      # Smaug (EmbeddingGemma-2)

    # ── Deterministic Forensic Analysis ────────────────────────────────
    include_forensics: bool
    forensic_results: Optional[Dict[str, Any]]

    # ── External context & victim intake ──────────────────────────────
    online_search_results: Optional[List[Dict[str, Any]]]
    user_answers: Optional[Dict[str, Any]]

    # ── Synthesis, manifest & drafting ─────────────────────────────────
    evidence_manifest: Optional[Dict[str, Any]]
    complaint_draft: Optional[Dict[str, Any]]

    # ── Human oversight & examiner review ─────────────────────────────
    # Human annotations do NOT overwrite original model outputs
    review_status: Dict[str, Any]

    # ── Fault tolerance & audit trail (Aggregated via operator.add) ───
    errors: Annotated[List[Dict[str, Any]], operator.add]
    audit_events: Annotated[List[Dict[str, Any]], operator.add]

    # ── Evidence-oriented summary outcome ──────────────────────────────
    workflow_status: str
    human_readable_explanation: str
