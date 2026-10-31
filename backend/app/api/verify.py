"""
ShieldHer – POST /verify endpoint.

Forensic verification pipeline:
1. Passes evidence image through Quality Gateway (validates format, dimensions, blur, brightness, contrast, face detection).
2. If quality fails, stops and reports without executing ML inference.
3. If quality passes, extracts derivatives and executes pretrained forensic detectors independently:
   - Effort-AIGI-Detection: evaluates face crop for face manipulation and face-swap artifacts.
   - Smaug-AI-Image-Detector: evaluates full image at native resolution for full-image AI generation.
4. Returns combined quality metrics and independent detector verdicts with full score semantics and optional Grad-CAM.
"""
from __future__ import annotations

import io
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, File, Query, Response, UploadFile, status
from PIL import Image
import numpy as np
import structlog

from app.config import get_settings
from app.schemas.upload import AssessmentStatus
from app.schemas.verification import (
    ModelInferenceStatus,
    VerificationOutcome,
    VerificationResponse,
)
from app.services.effort_adapter import get_effort_adapter
from app.services.image_processor import get_image_processor
from app.services.smaug_adapter import get_smaug_adapter
from app.services.forensic_service import get_forensic_service

router = APIRouter(tags=["verification"])
logger = structlog.get_logger(__name__)


@router.post(
    "/verify",
    response_model=VerificationResponse,
    summary="Verify evidence image for face manipulation and full-image AI generation",
    description=(
        "Full forensic pipeline: first evaluates image through the Quality Gateway. "
        "If quality criteria are met, executes the pretrained Effort model "
        "(CLIP-ViT-L/14 with SVD Residuals) on the face crop and the Smaug model "
        "(EmbeddingGemma-2 vision-only backbone) on the full image at native resolution."
    ),
    responses={
        200: {"model": VerificationResponse, "description": "Verification completed or retry required"},
        400: {"model": VerificationResponse, "description": "Quality gateway rejected unsupported input"},
        500: {"model": VerificationResponse, "description": "Internal verification error"},
    },
)
async def verify_image(
    response: Response,
    file: UploadFile = File(..., description="Evidence image file"),
    include_gradcam: bool = Query(
        default=False,
        description="Compute Grad-CAM activation heatmap overlay (ViT-L/14 patch tokens for Effort model)",
    ),
    include_effort: bool = Query(
        default=True,
        description="Run Effort-AIGI-Detection for face manipulation / face-swap detection",
    ),
    include_smaug: bool = Query(
        default=True,
        description="Run Smaug-AI-Image-Detector for full-image AI generation detection",
    ),
    include_forensics: bool = Query(
        default=False,
        description="Run optional deterministic forensic analysis suite (FFT, residuals, blockiness/ELA, seams)",
    ),
) -> VerificationResponse:
    settings = get_settings()
    processor = get_image_processor()
    effort_adapter = get_effort_adapter()
    smaug_adapter = get_smaug_adapter()

    # ── 1. Read Upload Stream ─────────────────────────────────────────
    try:
        raw_bytes = await file.read()
    except Exception as exc:
        logger.error("Failed to read upload stream", error=str(exc))
        response.status_code = status.HTTP_400_BAD_REQUEST
        thresholds = processor.get_provisional_thresholds()
        from app.schemas.upload import UploadResponse
        empty_quality = UploadResponse(
            status=AssessmentStatus.UNSUPPORTED_INPUT,
            reasons=[],
            message=f"Failed to read file stream: {exc}",
            evidence_id="",
            thresholds=thresholds,
        )
        return VerificationResponse(
            verification_status=VerificationOutcome.QUALITY_GATEWAY_REJECTED,
            message="Evidence upload failed stream reading.",
            evidence_id="",
            quality_assessment=empty_quality,
        )

    # ── 2. Quality Gateway ────────────────────────────────────────────
    quality_result = processor.process_upload(
        raw_bytes=raw_bytes,
        filename=file.filename,
        content_type=file.content_type,
    )

    # If Quality Gateway rejected input (empty, corrupt, invalid magic bytes)
    if quality_result.status == AssessmentStatus.UNSUPPORTED_INPUT:
        response.status_code = status.HTTP_400_BAD_REQUEST
        return VerificationResponse(
            verification_status=VerificationOutcome.QUALITY_GATEWAY_REJECTED,
            message=f"Quality Gateway rejected evidence: {quality_result.message}",
            evidence_id=quality_result.evidence_id,
            sha256=quality_result.sha256,
            quality_assessment=quality_result,
        )

    # If Quality Gateway requires retry (no face, blurry, under/over-exposed)
    if quality_result.status == AssessmentStatus.RETRY_REQUIRED:
        response.status_code = status.HTTP_200_OK
        return VerificationResponse(
            verification_status=VerificationOutcome.QUALITY_GATEWAY_RETRY_REQUIRED,
            message=(
                "Quality Gateway halted before detection: image quality is insufficient. "
                f"Issues: {', '.join(r.value for r in quality_result.reasons)}."
            ),
            evidence_id=quality_result.evidence_id,
            sha256=quality_result.sha256,
            quality_assessment=quality_result,
        )

    # If internal processing error occurred in quality processor
    if quality_result.status == AssessmentStatus.PROCESSING_ERROR:
        response.status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        return VerificationResponse(
            verification_status=VerificationOutcome.DETECTION_FAILED,
            message=f"Quality processing error: {quality_result.message}",
            evidence_id=quality_result.evidence_id,
            sha256=quality_result.sha256,
            quality_assessment=quality_result,
        )

    # ── 3. Prepare Image Derivatives ─────────────────────────────────
    # A. Full image for Smaug (evaluates whole scene at native resolution via views())
    full_image_for_smaug: Optional[Image.Image] = None
    smaug_input_source = "normalized_image"
    if quality_result.derivatives and quality_result.derivatives.normalized_image_path:
        norm_full_path = settings.upload_dir / quality_result.derivatives.normalized_image_path
        if norm_full_path.exists():
            full_image_for_smaug = Image.open(norm_full_path).convert("RGB")
            smaug_input_source = "normalized_image"

    if full_image_for_smaug is None:
        full_image_for_smaug = Image.open(io.BytesIO(raw_bytes)).convert("RGB")
        smaug_input_source = "raw_fallback"

    # B. Face crop for Effort (evaluates face manipulation and face-swap artifacts)
    face_image_for_effort: Optional[np.ndarray] = None
    effort_input_source = "face_crop"
    if quality_result.derivatives and quality_result.derivatives.face_crop_path:
        crop_full_path = settings.upload_dir / quality_result.derivatives.face_crop_path
        if crop_full_path.exists():
            pil_crop = Image.open(crop_full_path).convert("RGB")
            face_image_for_effort = np.array(pil_crop)
            effort_input_source = "face_crop"

    if face_image_for_effort is None and full_image_for_smaug is not None:
        face_image_for_effort = np.array(full_image_for_smaug)
        effort_input_source = "full_image"

    # ── 4. Execute Detectors Independently ─────────────────────────────
    # Failure of one detector must never erase or block the other!
    effort_detection = None
    if include_effort and face_image_for_effort is not None:
        effort_detection = effort_adapter.predict(
            rgb_image=face_image_for_effort,
            include_gradcam=include_gradcam,
            input_source_used=effort_input_source,
        )

    smaug_detection = None
    if include_smaug and full_image_for_smaug is not None:
        smaug_detection = smaug_adapter.predict(
            image=full_image_for_smaug,
            crops=settings.smaug_num_crops,
            input_source_used=smaug_input_source,
        )

    # ── 4b. Optional Deterministic Forensic Analysis ───────────────────
    forensic_report = None
    if include_forensics and full_image_for_smaug is not None:
        forensic_service = get_forensic_service()
        detected_fmt = (
            quality_result.file_metadata.detected_format
            if quality_result.file_metadata and quality_result.file_metadata.detected_format
            else "UNKNOWN"
        )
        forensic_report = forensic_service.generate_forensic_report(
            rgb_image=np.array(full_image_for_smaug),
            evidence_id=quality_result.evidence_id,
            detected_format=detected_fmt,
            detected_faces=quality_result.faces,
            sha256=quality_result.sha256,
        )

    # ── 5. Synthesize Verification Outcome ─────────────────────────────
    active_statuses: List[ModelInferenceStatus] = []
    if effort_detection is not None:
        active_statuses.append(effort_detection.status)
    if smaug_detection is not None:
        active_statuses.append(smaug_detection.status)

    if not active_statuses:
        outcome = VerificationOutcome.VERIFIED
        msg = "Quality Gateway passed; no ML detectors were selected."
    elif any(s == ModelInferenceStatus.SUCCESS for s in active_statuses):
        outcome = VerificationOutcome.VERIFIED
        messages = []
        if effort_detection and effort_detection.status == ModelInferenceStatus.SUCCESS:
            messages.append(
                f"Effort (face manipulation): {effort_detection.predicted_label.value} "
                f"(score: {effort_detection.manipulation_score})"
            )
        elif effort_detection:
            messages.append(f"Effort: {effort_detection.status.value}")

        if smaug_detection and smaug_detection.status == ModelInferenceStatus.SUCCESS:
            messages.append(
                f"Smaug (full-image AI): {smaug_detection.predicted_label.value} "
                f"(score: {smaug_detection.ai_generation_score})"
            )
        elif smaug_detection:
            messages.append(f"Smaug: {smaug_detection.status.value}")

        msg = f"Forensic verification completed. {'; '.join(messages)}."
    elif all(s == ModelInferenceStatus.UNAVAILABLE for s in active_statuses):
        outcome = VerificationOutcome.DETECTOR_UNAVAILABLE
        msg = "All requested detection models are currently unavailable (missing checkpoints or weights)."
    else:
        outcome = VerificationOutcome.DETECTION_FAILED
        msg = "Detection models encountered errors during execution."

    return VerificationResponse(
        verification_status=outcome,
        message=msg,
        evidence_id=quality_result.evidence_id,
        sha256=quality_result.sha256,
        quality_assessment=quality_result,
        effort_detection=effort_detection,
        smaug_detection=smaug_detection,
        detection=effort_detection,  # Backward compatibility
        forensic_report=forensic_report,
    )
