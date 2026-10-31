"""
ShieldHer – LangGraph Workflow Node Implementations.

Implements modular node processors for:
- Upload validation & custody hashing
- Quality Gateway & face detection
- Parallel EFFORT (face manipulation) & Smaug (AI generation) detection
- Deterministic forensic analysis
- Evidence synthesis & complaint drafting
"""
from __future__ import annotations

import datetime
import hashlib
import io
from pathlib import Path
from typing import Any, Dict, List, Optional
import numpy as np
from PIL import Image
import structlog

from app.config import get_settings
from app.schemas.upload import AssessmentStatus
from app.schemas.verification import ModelInferenceStatus
from app.services.effort_adapter import get_effort_adapter
from app.services.forensic_service import get_forensic_service
from app.services.image_processor import get_image_processor
from app.services.smaug_adapter import get_smaug_adapter
from app.workflows.state import (
    EvidenceWorkflowStatus,
    HumanReviewDecision,
    ImageState,
)

logger = structlog.get_logger(__name__)


def _utc_now_iso() -> str:
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


# ── Node 1: Upload & Ingestion ─────────────────────────────────────────

def upload_node(state: ImageState) -> Dict[str, Any]:
    """
    Validates upload stream, calculates original SHA-256 hash,
    and checks required consent flags. Idempotent if hash already computed.
    """
    case_id = state.get("case_id", "case_unassigned")
    session_id = state.get("session_id", "session_unassigned")
    consent = state.get("consent_flags", {})

    audit_events: List[Dict[str, Any]] = []
    errors: List[Dict[str, Any]] = []

    # Idempotency check
    if state.get("image_hash") and state.get("upload_validation"):
        audit_events.append({
            "timestamp": _utc_now_iso(),
            "event": "UPLOAD_INGESTION_IDEMPOTENT_HIT",
            "case_id": case_id,
            "session_id": session_id,
        })
        return {"audit_events": audit_events}

    raw_bytes = state.get("raw_bytes")
    if not raw_bytes:
        err = {"node": "upload_node", "error": "Missing raw_bytes stream for evidence upload"}
        errors.append(err)
        return {
            "workflow_status": EvidenceWorkflowStatus.UNSUPPORTED_INPUT.value,
            "human_readable_explanation": "No file stream provided for evidence processing.",
            "errors": errors,
            "audit_events": [{
                "timestamp": _utc_now_iso(),
                "event": "UPLOAD_FAILED_MISSING_BYTES",
                "case_id": case_id,
            }],
        }

    # 1. Compute original hash
    sha256_hash = hashlib.sha256(raw_bytes).hexdigest()

    # 2. Check user consent
    has_storage_consent = consent.get("consent_evidence_storage", True)
    has_processing_consent = consent.get("consent_forensic_processing", True)

    if not has_processing_consent:
        err = {"node": "upload_node", "error": "Forensic processing consent not granted by user"}
        errors.append(err)
        return {
            "image_hash": sha256_hash,
            "workflow_status": EvidenceWorkflowStatus.PROCESSING_ERROR.value,
            "human_readable_explanation": "Evidence processing halted: required user consent was not granted.",
            "errors": errors,
            "audit_events": [{
                "timestamp": _utc_now_iso(),
                "event": "CONSENT_REJECTED",
                "case_id": case_id,
            }],
        }

    # 3. Magic byte check
    is_valid_magic = (
        raw_bytes.startswith(b"\xff\xd8\xff")  # JPEG
        or raw_bytes.startswith(b"\x89PNG\r\n\x1a\n")  # PNG
        or (raw_bytes.startswith(b"RIFF") and b"WEBP" in raw_bytes[:16])  # WEBP
    )

    if not is_valid_magic:
        err = {"node": "upload_node", "error": "Invalid magic byte header. Supported: JPEG, PNG, WEBP."}
        errors.append(err)
        return {
            "image_hash": sha256_hash,
            "upload_validation": {"is_valid": False, "reason": "UNSUPPORTED_MAGIC_BYTES"},
            "workflow_status": EvidenceWorkflowStatus.UNSUPPORTED_INPUT.value,
            "human_readable_explanation": "File signature rejected. Only authentic JPEG, PNG, and WebP images are supported.",
            "errors": errors,
            "audit_events": [{
                "timestamp": _utc_now_iso(),
                "event": "UPLOAD_MAGIC_BYTES_REJECTED",
                "sha256": sha256_hash,
            }],
        }

    audit_events.append({
        "timestamp": _utc_now_iso(),
        "event": "UPLOAD_INGESTED_AND_HASHED",
        "case_id": case_id,
        "session_id": session_id,
        "sha256": sha256_hash,
        "has_storage_consent": has_storage_consent,
    })

    return {
        "image_hash": sha256_hash,
        "upload_validation": {"is_valid": True, "sha256": sha256_hash},
        "audit_events": audit_events,
    }


# ── Node 2: Quality Gateway ───────────────────────────────────────────

def quality_gateway_node(state: ImageState) -> Dict[str, Any]:
    """
    Evaluates image dimensions, blur, contrast, brightness, and face detection.
    Generates non-destructive derivatives. Idempotent if quality already assessed.
    """
    case_id = state.get("case_id", "case_unassigned")
    audit_events: List[Dict[str, Any]] = []
    errors: List[Dict[str, Any]] = []

    # Idempotency check
    if state.get("quality_assessment"):
        audit_events.append({
            "timestamp": _utc_now_iso(),
            "event": "QUALITY_GATEWAY_IDEMPOTENT_HIT",
            "case_id": case_id,
        })
        return {"audit_events": audit_events}

    raw_bytes = state.get("raw_bytes")
    if not raw_bytes:
        errors.append({"node": "quality_gateway_node", "error": "No raw bytes for quality assessment"})
        return {
            "workflow_status": EvidenceWorkflowStatus.PROCESSING_ERROR.value,
            "errors": errors,
        }

    processor = get_image_processor()
    quality_result = processor.process_upload(
        raw_bytes=raw_bytes,
        filename=state.get("filename"),
        content_type=state.get("content_type"),
    )

    detected_faces_data = [f.model_dump() for f in quality_result.faces]
    quality_dict = quality_result.model_dump()

    storage_ref = None
    if quality_result.derivatives and quality_result.derivatives.normalized_image_path:
        storage_ref = quality_result.derivatives.normalized_image_path

    audit_events.append({
        "timestamp": _utc_now_iso(),
        "event": "QUALITY_GATEWAY_COMPLETED",
        "case_id": case_id,
        "assessment_status": quality_result.status.value,
        "face_count": quality_result.face_count,
    })

    detected_fmt = (
        quality_result.file_metadata.detected_format
        if quality_result.file_metadata
        else "UNKNOWN"
    )

    return {
        "quality_assessment": quality_dict,
        "face_detection": {
            "face_count": quality_result.face_count,
            "faces": detected_faces_data,
        },
        "storage_reference": storage_ref,
        "detected_format": detected_fmt,
        "audit_events": audit_events,
    }


def should_run_inference(state: ImageState) -> str:
    """
    Conditional edge: routes to parallel ML inference if Quality Gateway passes,
    or directly to evidence summary if input is unsupported or retry is required.
    """
    qa = state.get("quality_assessment") or {}
    q_status = qa.get("status")

    if q_status == AssessmentStatus.PASS.value:
        return "run_models"
    elif q_status == AssessmentStatus.UNSUPPORTED_INPUT.value:
        return "unsupported"
    else:
        return "quality_retry"


# ── Node 3a: Parallel EFFORT Detection (Face Manipulation) ─────────────

def effort_detection_node(state: ImageState) -> Dict[str, Any]:
    """
    Executes pretrained EFFORT model (CLIP-ViT-L/14 with SVD Residuals) on the face crop.
    Independent execution: failure does not block Smaug. Idempotent if result exists.
    """
    case_id = state.get("case_id", "case_unassigned")
    audit_events: List[Dict[str, Any]] = []
    errors: List[Dict[str, Any]] = []

    # Idempotency check
    if state.get("face_manipulation_result"):
        audit_events.append({
            "timestamp": _utc_now_iso(),
            "event": "EFFORT_DETECTION_IDEMPOTENT_HIT",
            "case_id": case_id,
        })
        return {"audit_events": audit_events}

    settings = get_settings()
    adapter = get_effort_adapter()

    # Locate face crop derivative or fallback to normalized image / raw bytes
    qa = state.get("quality_assessment") or {}
    derivatives = qa.get("derivatives") or {}
    face_crop_rel = derivatives.get("face_crop_path")

    crop_img: Optional[np.ndarray] = None
    input_source = "face_crop"

    if face_crop_rel:
        full_crop_path = settings.upload_dir / face_crop_rel
        if full_crop_path.exists():
            try:
                pil_c = Image.open(full_crop_path).convert("RGB")
                crop_img = np.array(pil_c)
            except Exception as e:
                logger.warning("Could not read face crop for Effort", error=str(e))

    if crop_img is None:
        norm_rel = derivatives.get("normalized_image_path")
        if norm_rel:
            full_norm_path = settings.upload_dir / norm_rel
            if full_norm_path.exists():
                try:
                    pil_n = Image.open(full_norm_path).convert("RGB")
                    crop_img = np.array(pil_n)
                    input_source = "full_image_fallback"
                except Exception as e:
                    logger.warning("Could not read normalized image for Effort", error=str(e))

    if crop_img is None and state.get("raw_bytes"):
        try:
            pil_raw = Image.open(io.BytesIO(state["raw_bytes"])).convert("RGB")
            crop_img = np.array(pil_raw)
            input_source = "raw_fallback"
        except Exception as e:
            logger.error("Could not decode raw bytes for Effort", error=str(e))

    if crop_img is None:
        err = {"node": "effort_detection_node", "error": "No image crop available for face manipulation inference"}
        errors.append(err)
        res_data = {
            "status": ModelInferenceStatus.ERROR.value,
            "error_message": "No valid image crop found for Effort inference",
            "model_name": "Effort-AIGI-Detection",
        }
        return {"face_manipulation_result": res_data, "errors": errors}

    # Run Effort model adapter
    try:
        detection = adapter.predict(rgb_image=crop_img, input_source_used=input_source)
        res_data = detection.model_dump()
        audit_events.append({
            "timestamp": _utc_now_iso(),
            "event": "EFFORT_DETECTION_EXECUTED",
            "case_id": case_id,
            "status": detection.status.value,
            "manipulation_score": detection.manipulation_score,
            "predicted_label": detection.predicted_label.value if detection.predicted_label else None,
        })
    except Exception as exc:
        logger.error("Unexpected failure in Effort node", error=str(exc))
        errors.append({"node": "effort_detection_node", "error": str(exc)})
        res_data = {
            "status": ModelInferenceStatus.ERROR.value,
            "error_message": f"Effort inference error: {exc}",
            "model_name": "Effort-AIGI-Detection",
        }

    return {
        "face_manipulation_result": res_data,
        "audit_events": audit_events,
        "errors": errors,
    }


# ── Node 3b: Parallel Smaug Detection (AI Generation) ─────────────────

def smaug_detection_node(state: ImageState) -> Dict[str, Any]:
    """
    Executes pretrained Smaug model (EmbeddingGemma-2) on the full image at native resolution.
    Independent execution: failure does not block EFFORT. Idempotent if result exists.
    """
    case_id = state.get("case_id", "case_unassigned")
    audit_events: List[Dict[str, Any]] = []
    errors: List[Dict[str, Any]] = []

    # Idempotency check
    if state.get("ai_generation_result"):
        audit_events.append({
            "timestamp": _utc_now_iso(),
            "event": "SMAUG_DETECTION_IDEMPOTENT_HIT",
            "case_id": case_id,
        })
        return {"audit_events": audit_events}

    settings = get_settings()
    adapter = get_smaug_adapter()

    # Locate normalized full image or raw bytes
    qa = state.get("quality_assessment") or {}
    derivatives = qa.get("derivatives") or {}
    norm_rel = derivatives.get("normalized_image_path")

    full_pil: Optional[Image.Image] = None
    input_source = "normalized_image"

    if norm_rel:
        full_norm_path = settings.upload_dir / norm_rel
        if full_norm_path.exists():
            try:
                full_pil = Image.open(full_norm_path).convert("RGB")
            except Exception as e:
                logger.warning("Could not read normalized image for Smaug", error=str(e))

    if full_pil is None and state.get("raw_bytes"):
        try:
            full_pil = Image.open(io.BytesIO(state["raw_bytes"])).convert("RGB")
            input_source = "raw_fallback"
        except Exception as e:
            logger.error("Could not decode raw bytes for Smaug", error=str(e))

    if full_pil is None:
        err = {"node": "smaug_detection_node", "error": "No full image available for AI generation inference"}
        errors.append(err)
        res_data = {
            "status": ModelInferenceStatus.ERROR.value,
            "error_message": "No valid full image found for Smaug inference",
            "model_name": "Smaug-AI-Image-Detector",
        }
        return {"ai_generation_result": res_data, "errors": errors}

    # Run Smaug model adapter
    try:
        detection = adapter.predict(
            image=full_pil,
            crops=settings.smaug_num_crops,
            input_source_used=input_source,
        )
        res_data = detection.model_dump()
        audit_events.append({
            "timestamp": _utc_now_iso(),
            "event": "SMAUG_DETECTION_EXECUTED",
            "case_id": case_id,
            "status": detection.status.value,
            "ai_generation_score": detection.ai_generation_score,
            "predicted_label": detection.predicted_label.value if detection.predicted_label else None,
        })
    except Exception as exc:
        logger.error("Unexpected failure in Smaug node", error=str(exc))
        errors.append({"node": "smaug_detection_node", "error": str(exc)})
        res_data = {
            "status": ModelInferenceStatus.ERROR.value,
            "error_message": f"Smaug inference error: {exc}",
            "model_name": "Smaug-AI-Image-Detector",
        }

    return {
        "ai_generation_result": res_data,
        "audit_events": audit_events,
        "errors": errors,
    }


# ── Node 4: Deterministic Forensic Analysis ───────────────────────────

def forensic_analysis_node(state: ImageState) -> Dict[str, Any]:
    """
    Executes optional deterministic forensic analysis (FFT, residuals, blockiness, ELA, boundary seams).
    Idempotent if results already generated.
    """
    case_id = state.get("case_id", "case_unassigned")
    audit_events: List[Dict[str, Any]] = []
    errors: List[Dict[str, Any]] = []

    # Check if forensics was requested
    if not state.get("include_forensics", True):
        audit_events.append({
            "timestamp": _utc_now_iso(),
            "event": "FORENSIC_ANALYSIS_SKIPPED_NOT_REQUESTED",
            "case_id": case_id,
        })
        return {"audit_events": audit_events}

    # Idempotency check
    if state.get("forensic_results"):
        audit_events.append({
            "timestamp": _utc_now_iso(),
            "event": "FORENSIC_ANALYSIS_IDEMPOTENT_HIT",
            "case_id": case_id,
        })
        return {"audit_events": audit_events}

    settings = get_settings()
    forensic_service = get_forensic_service()

    # Load RGB image
    qa = state.get("quality_assessment") or {}
    derivatives = qa.get("derivatives") or {}
    norm_rel = derivatives.get("normalized_image_path")
    full_arr: Optional[np.ndarray] = None

    if norm_rel:
        full_norm_path = settings.upload_dir / norm_rel
        if full_norm_path.exists():
            try:
                pil_n = Image.open(full_norm_path).convert("RGB")
                full_arr = np.array(pil_n)
            except Exception as e:
                logger.warning("Could not read normalized image for forensics", error=str(e))

    if full_arr is None and state.get("raw_bytes"):
        try:
            pil_raw = Image.open(io.BytesIO(state["raw_bytes"])).convert("RGB")
            full_arr = np.array(pil_raw)
        except Exception as e:
            logger.error("Could not decode raw bytes for forensics", error=str(e))

    if full_arr is None:
        errors.append({"node": "forensic_analysis_node", "error": "No image available for forensic analysis"})
        return {"errors": errors}

    # Extract detected faces
    face_info = state.get("face_detection") or {}
    raw_faces = face_info.get("faces", [])
    from app.schemas.upload import DetectedFace
    parsed_faces = []
    for rf in raw_faces:
        try:
            parsed_faces.append(DetectedFace(**rf))
        except Exception:
            pass

    evidence_id = qa.get("evidence_id") or state.get("image_hash") or "evidence"
    detected_fmt = state.get("detected_format") or "UNKNOWN"

    try:
        report = forensic_service.generate_forensic_report(
            rgb_image=full_arr,
            evidence_id=evidence_id,
            detected_format=detected_fmt,
            detected_faces=parsed_faces,
            sha256=state.get("image_hash"),
        )
        report_dict = report.model_dump()
        audit_events.append({
            "timestamp": _utc_now_iso(),
            "event": "FORENSIC_ANALYSIS_COMPLETED",
            "case_id": case_id,
            "status": report.status.value,
        })
        return {"forensic_results": report_dict, "audit_events": audit_events}
    except Exception as exc:
        logger.error("Forensic analysis failed", error=str(exc))
        errors.append({"node": "forensic_analysis_node", "error": str(exc)})
        return {"errors": errors}


# ── Node 5: Evidence Summary & Synthesis ──────────────────────────────

def evidence_summary_node(state: ImageState) -> Dict[str, Any]:
    """
    Synthesizes independent model outputs into evidence-oriented states:
    - POSSIBLE_FACE_MANIPULATION
    - POSSIBLE_AI_GENERATION
    - POSSIBLE_COMBINED_MANIPULATION
    - CONFLICTING_MODEL_RESULTS
    - INCONCLUSIVE
    - INSUFFICIENT_IMAGE_QUALITY
    - UNSUPPORTED_INPUT

    CRITICAL RULES APPLIED:
    1. NEVER combine raw scores via arbitrary weights.
    2. NEVER label an image AUTHENTIC merely because detectors return low scores.
    3. Keep model failures explicit without discarding valid outputs.
    4. Compile evidence manifest and support human review without overwriting outputs.
    """
    case_id = state.get("case_id", "case_unassigned")
    session_id = state.get("session_id", "session_unassigned")
    audit_events: List[Dict[str, Any]] = []

    qa = state.get("quality_assessment") or {}
    q_status = qa.get("status")

    effort_res = state.get("face_manipulation_result") or {}
    smaug_res = state.get("ai_generation_result") or {}

    effort_status = effort_res.get("status")
    smaug_status = smaug_res.get("status")

    effort_score = effort_res.get("manipulation_score")
    smaug_score = smaug_res.get("ai_generation_score")

    # 1. Check Quality Gateway gates
    if q_status == AssessmentStatus.UNSUPPORTED_INPUT.value:
        workflow_status = EvidenceWorkflowStatus.UNSUPPORTED_INPUT.value
        explanation = f"Evidence submission rejected: {qa.get('message', 'Unsupported input format or signature')}."
    elif q_status == AssessmentStatus.RETRY_REQUIRED.value:
        workflow_status = EvidenceWorkflowStatus.INSUFFICIENT_IMAGE_QUALITY.value
        reasons = qa.get("reasons", [])
        explanation = (
            "Quality Gateway halted processing: image quality is insufficient for reliable forensic evaluation. "
            f"Reasons: {', '.join(reasons) if reasons else 'Quality criteria not met'}."
        )
    elif q_status == AssessmentStatus.PROCESSING_ERROR.value:
        workflow_status = EvidenceWorkflowStatus.PROCESSING_ERROR.value
        explanation = "Processing error occurred during initial quality assessment."
    else:
        # 2. Evaluate model outputs
        effort_flagged = (effort_status == ModelInferenceStatus.SUCCESS.value and effort_score is not None and effort_score >= 0.50)
        effort_clean = (effort_status == ModelInferenceStatus.SUCCESS.value and effort_score is not None and effort_score < 0.50)

        smaug_flagged = (smaug_status == ModelInferenceStatus.SUCCESS.value and smaug_score is not None and smaug_score >= 0.50)
        smaug_clean = (smaug_status == ModelInferenceStatus.SUCCESS.value and smaug_score is not None and smaug_score < 0.50)

        model_failures = []
        if effort_status in (ModelInferenceStatus.UNAVAILABLE.value, ModelInferenceStatus.ERROR.value):
            model_failures.append(f"Effort model {effort_status.lower()}: {effort_res.get('error_message', 'No details')}")
        if smaug_status in (ModelInferenceStatus.UNAVAILABLE.value, ModelInferenceStatus.ERROR.value):
            model_failures.append(f"Smaug model {smaug_status.lower()}: {smaug_res.get('error_message', 'No details')}")

        if effort_flagged and smaug_flagged:
            workflow_status = EvidenceWorkflowStatus.POSSIBLE_COMBINED_MANIPULATION.value
            explanation = (
                f"Both detectors flagged positive forgery signals: face manipulation detected "
                f"(Effort score: {effort_score:.3f}), and full-image generative synthesis detected "
                f"(Smaug score: {smaug_score:.3f})."
            )
        elif effort_flagged and smaug_clean:
            workflow_status = EvidenceWorkflowStatus.POSSIBLE_FACE_MANIPULATION.value
            explanation = (
                f"Effort detector flagged face-swap or face manipulation artifacts (score: {effort_score:.3f}), "
                f"while full-image synthesis score was below threshold (Smaug score: {smaug_score:.3f}). "
                "This profile is characteristic of deepfake face replacements composited onto authentic scenes."
            )
        elif smaug_flagged and effort_clean:
            workflow_status = EvidenceWorkflowStatus.POSSIBLE_AI_GENERATION.value
            explanation = (
                f"Smaug detector flagged full-image generative AI synthesis (score: {smaug_score:.3f}), "
                f"while isolated face manipulation score was low (Effort score: {effort_score:.3f}). "
                "This profile is characteristic of end-to-end diffusion or GAN generation."
            )
        elif effort_clean and smaug_clean:
            # CRITICAL MANDATE: NEVER claim AUTHENTIC
            workflow_status = EvidenceWorkflowStatus.INCONCLUSIVE.value
            explanation = (
                f"Neither detector flagged manipulation signals (Effort score: {effort_score:.3f}, Smaug score: {smaug_score:.3f}). "
                "CRITICAL FORENSIC NOTE: Low detection scores provide no positive evidence of manipulation, "
                "but do NOT prove authenticity or absence of novel generative evasion techniques. Verdict is INCONCLUSIVE."
            )
        elif (effort_flagged or smaug_flagged) and model_failures:
            # One model flagged while the other failed
            flagged_model = "Effort (face manipulation)" if effort_flagged else "Smaug (AI generation)"
            score_val = effort_score if effort_flagged else smaug_score
            workflow_status = (
                EvidenceWorkflowStatus.POSSIBLE_FACE_MANIPULATION.value
                if effort_flagged
                else EvidenceWorkflowStatus.POSSIBLE_AI_GENERATION.value
            )
            explanation = (
                f"{flagged_model} flagged positive manipulation signals (score: {score_val:.3f}). "
                f"Note: {'; '.join(model_failures)}."
            )
        elif model_failures and not (effort_flagged or smaug_flagged):
            workflow_status = EvidenceWorkflowStatus.INCONCLUSIVE.value
            explanation = (
                "Forensic evaluation was incomplete or inconclusive due to model unavailability: "
                f"{'; '.join(model_failures)}."
            )
        else:
            workflow_status = EvidenceWorkflowStatus.INCONCLUSIVE.value
            explanation = "Model outputs could not be definitively reconciled; result is inconclusive."

    # 3. Compile Evidence Manifest (Chain of Custody)
    evidence_manifest = {
        "case_id": case_id,
        "session_id": session_id,
        "evidence_sha256": state.get("image_hash"),
        "timestamp_utc": _utc_now_iso(),
        "storage_reference": state.get("storage_reference"),
        "quality_status": q_status,
        "models_evaluated": {
            "effort": {
                "evaluated": effort_status is not None,
                "status": effort_status,
                "score": effort_score,
                "model_identifier": effort_res.get("checkpoint_identifier"),
                "paper": "ICML 2025 Oral (Effort-AIGI-Detection)",
            },
            "smaug": {
                "evaluated": smaug_status is not None,
                "status": smaug_status,
                "score": smaug_score,
                "model_identifier": smaug_res.get("checkpoint_identifier"),
                "architecture": "Vision-only EmbeddingGemma-2",
            },
        },
        "deterministic_forensics_included": state.get("forensic_results") is not None,
    }

    # 4. Draft Structured Victim-Support Complaint
    complaint_draft = {
        "case_reference": case_id,
        "label": "DRAFT — FOR USER AND LEGAL REVIEW",
        "generated_at": _utc_now_iso(),
        "title": f"Forensic Evidence Report & Takedown Brief [Case: {case_id}]",
        "primary_finding": workflow_status,
        "summary": explanation,
        "chain_of_custody_hash": state.get("image_hash"),
        "recommended_remedies": [
            "Formal platform DMCA / NCII abuse notice under platform Terms of Service",
            "Emergency preservation request for uploader account metadata and IP records",
            "Submission to Take It Down / StopNCII hashing databases if applicable",
        ],
        "legal_notice": (
            "This report documents forensic signals and physical consistency measurements. "
            "It is intended to support victim advocacy and legal counsel; raw scores are unscaled "
            "and require expert evaluation in judicial proceedings."
        ),
    }

    # 5. Initialize human review status if unreviewed
    review_status = state.get("review_status") or {
        "decision": HumanReviewDecision.UNREVIEWED.value,
        "examiner_notes": None,
        "reviewed_by": None,
        "reviewed_at": None,
        "human_override": False,
    }

    audit_events.append({
        "timestamp": _utc_now_iso(),
        "event": "WORKFLOW_COMPLETED",
        "case_id": case_id,
        "final_status": workflow_status,
    })

    return {
        "workflow_status": workflow_status,
        "human_readable_explanation": explanation,
        "evidence_manifest": evidence_manifest,
        "complaint_draft": complaint_draft,
        "review_status": review_status,
        "audit_events": audit_events,
    }
