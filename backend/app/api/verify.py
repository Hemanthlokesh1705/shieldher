"""
ShieldHer – POST /verify and /verify/jobs endpoints.

Four-Model Forensic Verification Pipeline:
1. Passes evidence image through Quality Gateway (validates format, dimensions, blur, brightness, contrast, face detection).
2. If quality fails, stops and reports without executing ML inference.
3. If quality passes, extracts derivatives and executes the four forensic detectors independently:
   - Category A (Face Manipulation):
     1. Effort-AIGI-Detection (CLIP-ViT-L/14 with SVD Residuals, ICML 2025)
     2. GenD Deepfake Detector (CLIP-ViT-L/14 LinearNorm, WACV 2026)
   - Category B (Full-Image AI Generation):
     3. Smaug-AI-Image-Detector (EmbeddingGemma-2, Abacus.AI)
     4. Forensic-Self-Descriptions / FSD (FRE Residuals + GMM, CVPR 2025)
4. Emits real-time 10-step animated checkpoints for the frontend.
5. Computes transparent Category Agreement without blind uncalibrated averaging.
"""
from __future__ import annotations

import io
from pathlib import Path
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, File, HTTPException, Query, Response, UploadFile, status
from PIL import Image
import numpy as np
import structlog

from app.config import get_settings
from app.schemas.upload import AssessmentStatus, UploadResponse
from app.schemas.verification import (
    AgreementStatus,
    CategoryAgreement,
    CheckpointExecutionState,
    DetectionDetails,
    FSDDetectionDetails,
    GenDDetectionDetails,
    ModelCategory,
    ModelInferenceStatus,
    ModelRegistryEntry,
    SmaugDetectionDetails,
    VerificationOutcome,
    VerificationResponse,
)
from app.services.effort_adapter import get_effort_adapter
from app.services.fsd_adapter import get_fsd_adapter
from app.services.gend_adapter import get_gend_adapter
from app.services.image_processor import get_image_processor
from app.services.model_registry_service import (
    build_initial_registry,
    evaluate_ai_generation_agreement,
    evaluate_face_manipulation_agreement,
    update_registry_entry,
)
from app.services.smaug_adapter import get_smaug_adapter
from app.services.forensic_service import get_forensic_service
from app.services.verification_job_service import get_job_manager

router = APIRouter(tags=["verification"])
logger = structlog.get_logger(__name__)


# ── Direct Synchronous Verification (Backwards-Compatible) ────────────

@router.post(
    "/verify",
    response_model=VerificationResponse,
    summary="Verify evidence image with four independent detection models",
    description=(
        "Full forensic pipeline: first evaluates image through the Quality Gateway. "
        "If quality criteria pass, runs the four independent detectors: "
        "EFFORT and GenD (Face Manipulation), plus Smaug and FSD (Full-Image AI Generation)."
    ),
)
async def verify_image(
    response: Response,
    file: UploadFile = File(..., description="Evidence image file"),
    include_gradcam: bool = Query(
        default=False,
        description="Compute Grad-CAM activation heatmap overlay for Effort model",
    ),
    include_effort: bool = Query(
        default=True,
        description="Run Effort-AIGI-Detection for face manipulation / face-swap detection",
    ),
    include_gend: bool = Query(
        default=True,
        description="Run GenD for generalizable face manipulation / deepfake detection",
    ),
    include_smaug: bool = Query(
        default=True,
        description="Run Smaug-AI-Image-Detector for full-image AI generation detection",
    ),
    include_fsd: bool = Query(
        default=True,
        description="Run FSD (Forensic Self-Descriptions) for zero-shot forensic residual AI detection",
    ),
    include_forensics: bool = Query(
        default=False,
        description="Run optional deterministic forensic analysis suite (FFT, residuals, ELA)",
    ),
) -> VerificationResponse:
    settings = get_settings()
    processor = get_image_processor()

    # 1. Read Upload Stream
    try:
        raw_bytes = await file.read()
    except Exception as exc:
        logger.error("Failed to read upload stream", error=str(exc))
        response.status_code = status.HTTP_400_BAD_REQUEST
        thresholds = processor.get_provisional_thresholds()
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

    # 2. Quality Gateway
    quality_result = processor.process_upload(
        raw_bytes=raw_bytes,
        filename=file.filename,
        content_type=file.content_type,
    )

    if quality_result.status == AssessmentStatus.UNSUPPORTED_INPUT:
        response.status_code = status.HTTP_400_BAD_REQUEST
        return VerificationResponse(
            verification_status=VerificationOutcome.QUALITY_GATEWAY_REJECTED,
            message=f"Quality Gateway rejected evidence: {quality_result.message}",
            evidence_id=quality_result.evidence_id,
            sha256=quality_result.sha256,
            quality_assessment=quality_result,
        )

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

    if quality_result.status == AssessmentStatus.PROCESSING_ERROR:
        response.status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        return VerificationResponse(
            verification_status=VerificationOutcome.DETECTION_FAILED,
            message=f"Quality processing error: {quality_result.message}",
            evidence_id=quality_result.evidence_id,
            sha256=quality_result.sha256,
            quality_assessment=quality_result,
        )

    # 3. Prepare Image Derivatives
    full_image: Optional[Image.Image] = None
    if quality_result.derivatives and quality_result.derivatives.normalized_image_path:
        norm_full_path = settings.upload_dir / quality_result.derivatives.normalized_image_path
        if norm_full_path.exists():
            full_image = Image.open(norm_full_path).convert("RGB")

    if full_image is None:
        full_image = Image.open(io.BytesIO(raw_bytes)).convert("RGB")

    face_image: Optional[np.ndarray] = None
    face_input_source = "face_crop"
    if quality_result.derivatives and quality_result.derivatives.face_crop_path:
        crop_full_path = settings.upload_dir / quality_result.derivatives.face_crop_path
        if crop_full_path.exists():
            face_image = np.array(Image.open(crop_full_path).convert("RGB"))

    if face_image is None and full_image is not None:
        face_image = np.array(full_image)
        face_input_source = "full_image_fallback"

    # Initial registry & checkpoints
    enabled_models = []
    if include_effort:
        enabled_models.append("effort")
    if include_gend:
        enabled_models.append("gend")
    if include_smaug:
        enabled_models.append("smaug")
    if include_fsd:
        enabled_models.append("fsd")

    model_registry = build_initial_registry(enabled_models=enabled_models)
    checkpoints: Dict[str, CheckpointExecutionState] = {
        "image_upload": CheckpointExecutionState.COMPLETED,
        "image_validation": CheckpointExecutionState.COMPLETED,
        "face_detection": CheckpointExecutionState.COMPLETED,
        "quality_assessment": CheckpointExecutionState.COMPLETED,
        "effort_detection": CheckpointExecutionState.QUEUED if include_effort else CheckpointExecutionState.SKIPPED,
        "gend_detection": CheckpointExecutionState.QUEUED if include_gend else CheckpointExecutionState.SKIPPED,
        "smaug_detection": CheckpointExecutionState.QUEUED if include_smaug else CheckpointExecutionState.SKIPPED,
        "fsd_detection": CheckpointExecutionState.QUEUED if include_fsd else CheckpointExecutionState.SKIPPED,
        "forensic_summary": CheckpointExecutionState.QUEUED,
        "final_result": CheckpointExecutionState.QUEUED,
    }

    # 4. Execute Four Models Independently
    # Model 1: EFFORT
    effort_detection = None
    if include_effort and face_image is not None:
        checkpoints["effort_detection"] = CheckpointExecutionState.RUNNING
        effort_adapter = get_effort_adapter()
        effort_detection = effort_adapter.predict(
            rgb_image=face_image,
            include_gradcam=include_gradcam,
            input_source_used=face_input_source,
        )
        update_registry_entry(
            model_registry["effort"],
            status=effort_detection.status,
            duration_ms=effort_detection.inference_duration_ms,
            raw_output={
                "manipulation_score": effort_detection.manipulation_score,
                "predicted_label": effort_detection.predicted_label.value if effort_detection.predicted_label else None,
                "raw_logits": effort_detection.raw_logits,
            },
            error_message=effort_detection.error_message,
        )
        checkpoints["effort_detection"] = (
            CheckpointExecutionState.COMPLETED
            if effort_detection.status == ModelInferenceStatus.SUCCESS
            else CheckpointExecutionState.FAILED
        )

    # Model 2: GenD
    gend_detection = None
    if include_gend and face_image is not None:
        checkpoints["gend_detection"] = CheckpointExecutionState.RUNNING
        gend_adapter = get_gend_adapter()
        gend_detection = gend_adapter.predict(
            image=face_image,
            input_source_used=face_input_source,
        )
        update_registry_entry(
            model_registry["gend"],
            status=gend_detection.status,
            duration_ms=gend_detection.inference_duration_ms,
            raw_output={
                "genuine_score": gend_detection.genuine_score,
                "fake_score": gend_detection.fake_score,
                "predicted_class": gend_detection.predicted_class,
                "raw_logits": gend_detection.raw_logits,
            },
            error_message=gend_detection.error_message,
        )
        checkpoints["gend_detection"] = (
            CheckpointExecutionState.COMPLETED
            if gend_detection.status == ModelInferenceStatus.SUCCESS
            else CheckpointExecutionState.FAILED
        )

    # Model 3: Smaug
    smaug_detection = None
    if include_smaug and full_image is not None:
        checkpoints["smaug_detection"] = CheckpointExecutionState.RUNNING
        smaug_adapter = get_smaug_adapter()
        smaug_detection = smaug_adapter.predict(
            image=full_image,
            crops=settings.smaug_num_crops,
            input_source_used="normalized_image",
        )
        update_registry_entry(
            model_registry["smaug"],
            status=smaug_detection.status,
            duration_ms=smaug_detection.inference_duration_ms,
            raw_output={
                "ai_generation_score": smaug_detection.ai_generation_score,
                "crop_scores": smaug_detection.crop_scores,
                "predicted_label": smaug_detection.predicted_label.value if smaug_detection.predicted_label else None,
            },
            error_message=smaug_detection.error_message,
        )
        checkpoints["smaug_detection"] = (
            CheckpointExecutionState.COMPLETED
            if smaug_detection.status == ModelInferenceStatus.SUCCESS
            else CheckpointExecutionState.FAILED
        )

    # Model 4: FSD
    fsd_detection = None
    if include_fsd and full_image is not None:
        checkpoints["fsd_detection"] = CheckpointExecutionState.RUNNING
        fsd_adapter = get_fsd_adapter()
        fsd_detection = fsd_adapter.predict(image=full_image)
        update_registry_entry(
            model_registry["fsd"],
            status=fsd_detection.status,
            duration_ms=fsd_detection.inference_duration_ms,
            raw_output={
                "native_z_score": fsd_detection.native_z_score,
                "raw_score": fsd_detection.raw_score,
                "is_fake": fsd_detection.is_fake,
                "model_derived_decision": fsd_detection.model_derived_decision,
            },
            error_message=fsd_detection.error_message,
        )
        if fsd_detection.status == ModelInferenceStatus.SKIPPED:
            checkpoints["fsd_detection"] = CheckpointExecutionState.SKIPPED
        elif fsd_detection.status == ModelInferenceStatus.SUCCESS:
            checkpoints["fsd_detection"] = CheckpointExecutionState.COMPLETED
        else:
            checkpoints["fsd_detection"] = CheckpointExecutionState.FAILED

    # Category Agreement Analysis
    face_agreement = evaluate_face_manipulation_agreement(effort_detection, gend_detection)
    ai_agreement = evaluate_ai_generation_agreement(smaug_detection, fsd_detection)
    category_agreement = {
        "face_manipulation": face_agreement,
        "ai_generation": ai_agreement,
    }

    # Optional Deterministic Forensic Analysis
    checkpoints["forensic_summary"] = CheckpointExecutionState.RUNNING
    forensic_report = None
    if include_forensics and full_image is not None:
        forensic_service = get_forensic_service()
        detected_fmt = (
            quality_result.file_metadata.detected_format
            if quality_result.file_metadata and quality_result.file_metadata.detected_format
            else "UNKNOWN"
        )
        forensic_report = forensic_service.generate_forensic_report(
            rgb_image=np.array(full_image),
            evidence_id=quality_result.evidence_id,
            detected_format=detected_fmt,
            detected_faces=quality_result.faces,
            sha256=quality_result.sha256,
        )
    checkpoints["forensic_summary"] = CheckpointExecutionState.COMPLETED
    checkpoints["final_result"] = CheckpointExecutionState.COMPLETED

    # Build results map
    results_map = {
        "effort": effort_detection.model_dump() if effort_detection else {"status": "SKIPPED"},
        "gend": gend_detection.model_dump() if gend_detection else {"status": "SKIPPED"},
        "smaug": smaug_detection.model_dump() if smaug_detection else {"status": "SKIPPED"},
        "fsd": fsd_detection.model_dump() if fsd_detection else {"status": "SKIPPED"},
    }

    # Outcome synthesis
    active_statuses: List[ModelInferenceStatus] = []
    for d in [effort_detection, gend_detection, smaug_detection, fsd_detection]:
        if d is not None:
            active_statuses.append(d.status)

    if any(s == ModelInferenceStatus.SUCCESS for s in active_statuses):
        outcome = VerificationOutcome.VERIFIED
        msg = f"Four-model verification completed. Face Agreement: {face_agreement.status.value}; AI Agreement: {ai_agreement.status.value}."
    elif all(s in (ModelInferenceStatus.UNAVAILABLE, ModelInferenceStatus.SKIPPED) for s in active_statuses):
        outcome = VerificationOutcome.DETECTOR_UNAVAILABLE
        msg = "Requested models unavailable or skipped per licensing policy."
    else:
        outcome = VerificationOutcome.DETECTION_FAILED
        msg = "Detection models encountered errors during execution."

    return VerificationResponse(
        verification_status=outcome,
        message=msg,
        evidence_id=quality_result.evidence_id,
        verification_id=f"VERIF-{quality_result.evidence_id[:8].upper()}",
        sha256=quality_result.sha256,
        quality_assessment=quality_result,
        effort_detection=effort_detection,
        gend_detection=gend_detection,
        smaug_detection=smaug_detection,
        fsd_detection=fsd_detection,
        detection=effort_detection,
        checkpoints=checkpoints,
        model_registry=model_registry,
        category_agreement=category_agreement,
        results=results_map,
        forensic_report=forensic_report,
    )


# ── Asynchronous Verification Job API (Live Checkpoints & Polling) ────

@router.post(
    "/verify/jobs",
    summary="Start an asynchronous four-model verification job with animated checkpoints",
    description="Initiates background execution of the 10-step checkpoint pipeline and returns job_id for polling.",
)
async def start_verification_job(
    file: UploadFile = File(..., description="Evidence image file"),
    include_gradcam: bool = Query(default=False),
    include_effort: bool = Query(default=True),
    include_gend: bool = Query(default=True),
    include_smaug: bool = Query(default=True),
    include_fsd: bool = Query(default=True),
    include_forensics: bool = Query(default=False),
    case_id: Optional[str] = Query(default=None),
) -> Dict[str, Any]:
    try:
        raw_bytes = await file.read()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to read file stream: {exc}",
        )

    job_mgr = get_job_manager()
    job = job_mgr.create_job(
        filename=file.filename or "uploaded_evidence.png",
        content_type=file.content_type or "image/png",
        raw_bytes=raw_bytes,
        include_gradcam=include_gradcam,
        include_effort=include_effort,
        include_gend=include_gend,
        include_smaug=include_smaug,
        include_fsd=include_fsd,
        include_forensics=include_forensics,
        case_id=case_id,
    )
    return job.to_response()


@router.get(
    "/verify/jobs/{job_id}",
    summary="Poll status and progressive checkpoint results for an active verification job",
    description="Returns live checkpoint statuses and partial model results as individual detectors finish.",
)
async def get_verification_job(job_id: str) -> Dict[str, Any]:
    job_mgr = get_job_manager()
    job = job_mgr.get_job(job_id)
    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Verification job '{job_id}' not found.",
        )
    return job.to_response()
