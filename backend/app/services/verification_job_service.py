"""
ShieldHer – Verification Job Service.

Manages persistent in-memory / thread-safe verification jobs for:
- 10-step animated model checkpoint pipeline
- Real-time authenticated polling with progressive partial results
- Refresh recovery and deduplication
- Controlled execution (Quality Gateway -> Face Manipulation -> AI Generation -> Summary)
- Independent fault isolation across all four models:
  1. EFFORT (face manipulation)
  2. GenD (face manipulation)
  3. Smaug (full-image AI generation)
  4. FSD (forensic residual AI generation)
"""
from __future__ import annotations

import asyncio
import concurrent.futures
import datetime
import io
import threading
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional
import numpy as np
from PIL import Image
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
    PredictedLabel,
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

logger = structlog.get_logger(__name__)


CHECKPOINT_KEYS = [
    "image_upload",
    "image_validation",
    "face_detection",
    "quality_assessment",
    "effort_detection",
    "gend_detection",
    "smaug_detection",
    "fsd_detection",
    "forensic_summary",
    "final_result",
]


class VerificationJob:
    def __init__(
        self,
        job_id: str,
        filename: str,
        content_type: str,
        raw_bytes: bytes,
        include_gradcam: bool = False,
        include_effort: bool = True,
        include_gend: bool = True,
        include_smaug: bool = True,
        include_fsd: bool = True,
        include_forensics: bool = False,
        case_id: Optional[str] = None,
    ):
        self.job_id = job_id
        self.verification_id = f"VERIF-{job_id[:8].upper()}"
        self.filename = filename
        self.content_type = content_type
        self.raw_bytes = raw_bytes
        self.include_gradcam = include_gradcam
        self.include_effort = include_effort
        self.include_gend = include_gend
        self.include_smaug = include_smaug
        self.include_fsd = include_fsd
        self.include_forensics = include_forensics
        self.case_id = case_id

        self.created_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
        self.updated_at = self.created_at
        self.overall_status = "PROCESSING"  # PROCESSING, COMPLETED, FAILED, QUALITY_RETRY
        self.outcome = VerificationOutcome.VERIFIED
        self.message = "Initializing forensic verification pipeline..."
        self.evidence_id = ""
        self.sha256 = ""

        # Checkpoints state map
        self.checkpoints: Dict[str, CheckpointExecutionState] = {
            k: CheckpointExecutionState.QUEUED for k in CHECKPOINT_KEYS
        }
        self.checkpoints["image_upload"] = CheckpointExecutionState.COMPLETED
        self.checkpoints["image_validation"] = CheckpointExecutionState.RUNNING

        # Model Registry
        enabled_models = []
        if include_effort:
            enabled_models.append("effort")
        if include_gend:
            enabled_models.append("gend")
        if include_smaug:
            enabled_models.append("smaug")
        if include_fsd:
            enabled_models.append("fsd")
        self.model_registry = build_initial_registry(enabled_models=enabled_models)

        # Execution Results
        self.quality_assessment: Optional[UploadResponse] = None
        self.effort_detection: Optional[DetectionDetails] = None
        self.gend_detection: Optional[GenDDetectionDetails] = None
        self.smaug_detection: Optional[SmaugDetectionDetails] = None
        self.fsd_detection: Optional[FSDDetectionDetails] = None
        self.forensic_report = None
        self.category_agreement: Dict[str, CategoryAgreement] = {}
        self.results: Dict[str, Any] = {}

        self.error_message: Optional[str] = None
        self._lock = threading.Lock()

    def update_checkpoint(self, key: str, state: CheckpointExecutionState):
        with self._lock:
            self.checkpoints[key] = state
            self.updated_at = datetime.datetime.now(datetime.timezone.utc).isoformat()

    def to_response(self) -> Dict[str, Any]:
        with self._lock:
            # Recompute agreement dynamically if results exist
            if self.effort_detection or self.gend_detection:
                self.category_agreement["face_manipulation"] = evaluate_face_manipulation_agreement(
                    self.effort_detection, self.gend_detection
                )
            if self.smaug_detection or self.fsd_detection:
                self.category_agreement["ai_generation"] = evaluate_ai_generation_agreement(
                    self.smaug_detection, self.fsd_detection
                )

            # Build results dictionary
            results_dict: Dict[str, Any] = {
                "effort": (
                    self.effort_detection.model_dump()
                    if self.effort_detection
                    else {"status": self.model_registry["effort"].execution_state.value}
                ),
                "gend": (
                    self.gend_detection.model_dump()
                    if self.gend_detection
                    else {"status": self.model_registry["gend"].execution_state.value}
                ),
                "smaug": (
                    self.smaug_detection.model_dump()
                    if self.smaug_detection
                    else {"status": self.model_registry["smaug"].execution_state.value}
                ),
                "fsd": (
                    self.fsd_detection.model_dump()
                    if self.fsd_detection
                    else {"status": self.model_registry["fsd"].execution_state.value}
                ),
            }

            return {
                "job_id": self.job_id,
                "verification_id": self.verification_id,
                "overall_status": self.overall_status,
                "verification_status": self.outcome.value,
                "message": self.message,
                "evidence_id": self.evidence_id,
                "sha256": self.sha256,
                "created_at": self.created_at,
                "updated_at": self.updated_at,
                "checkpoints": {k: v.value for k, v in self.checkpoints.items()},
                "model_registry": {k: v.model_dump() for k, v in self.model_registry.items()},
                "category_agreement": {k: v.model_dump() for k, v in self.category_agreement.items()},
                "results": results_dict,
                "quality_assessment": (
                    self.quality_assessment.model_dump() if self.quality_assessment else None
                ),
                "effort_detection": (
                    self.effort_detection.model_dump() if self.effort_detection else None
                ),
                "gend_detection": (
                    self.gend_detection.model_dump() if self.gend_detection else None
                ),
                "smaug_detection": (
                    self.smaug_detection.model_dump() if self.smaug_detection else None
                ),
                "fsd_detection": (
                    self.fsd_detection.model_dump() if self.fsd_detection else None
                ),
                "detection": (
                    self.effort_detection.model_dump() if self.effort_detection else None
                ),
                "forensic_report": (
                    self.forensic_report.model_dump() if self.forensic_report else None
                ),
                "error_message": self.error_message,
            }


class VerificationJobManager:
    """
    In-memory registry of verification jobs with async background workers.
    """

    def __init__(self):
        self._jobs: Dict[str, VerificationJob] = {}
        self._executor = concurrent.futures.ThreadPoolExecutor(max_workers=2)
        self._lock = threading.Lock()

    def create_job(
        self,
        filename: str,
        content_type: str,
        raw_bytes: bytes,
        include_gradcam: bool = False,
        include_effort: bool = True,
        include_gend: bool = True,
        include_smaug: bool = True,
        include_fsd: bool = True,
        include_forensics: bool = False,
        case_id: Optional[str] = None,
    ) -> VerificationJob:
        job_id = str(uuid.uuid4())
        job = VerificationJob(
            job_id=job_id,
            filename=filename,
            content_type=content_type,
            raw_bytes=raw_bytes,
            include_gradcam=include_gradcam,
            include_effort=include_effort,
            include_gend=include_gend,
            include_smaug=include_smaug,
            include_fsd=include_fsd,
            include_forensics=include_forensics,
            case_id=case_id,
        )
        with self._lock:
            self._jobs[job_id] = job

        # Launch execution worker asynchronously
        self._executor.submit(self._run_job, job)
        return job

    def get_job(self, job_id: str) -> Optional[VerificationJob]:
        with self._lock:
            return self._jobs.get(job_id)

    def _run_job(self, job: VerificationJob):
        """
        Executes the 10-checkpoint workflow step by step with progressive status updates.
        """
        settings = get_settings()
        processor = get_image_processor()

        try:
            # ── 1. Image Validation Checkpoint ─────────────────────────────
            job.update_checkpoint("image_validation", CheckpointExecutionState.RUNNING)
            time.sleep(0.15)  # Visual smoothness for micro-transitions

            # Run Quality Gateway
            quality_result = processor.process_upload(
                raw_bytes=job.raw_bytes,
                filename=job.filename,
                content_type=job.content_type,
            )
            job.quality_assessment = quality_result
            job.evidence_id = quality_result.evidence_id
            job.sha256 = quality_result.sha256 or ""

            if quality_result.status == AssessmentStatus.UNSUPPORTED_INPUT:
                job.update_checkpoint("image_validation", CheckpointExecutionState.FAILED)
                job.overall_status = "FAILED"
                job.outcome = VerificationOutcome.QUALITY_GATEWAY_REJECTED
                job.message = f"Quality Gateway rejected evidence: {quality_result.message}"
                self._mark_remaining_skipped(job, ["face_detection", "quality_assessment", "effort_detection", "gend_detection", "smaug_detection", "fsd_detection", "forensic_summary", "final_result"])
                return

            job.update_checkpoint("image_validation", CheckpointExecutionState.COMPLETED)

            # ── 2. Face Detection Checkpoint ──────────────────────────────
            job.update_checkpoint("face_detection", CheckpointExecutionState.RUNNING)
            face_count = len(quality_result.faces) if quality_result.faces else 0
            time.sleep(0.2)
            job.update_checkpoint("face_detection", CheckpointExecutionState.COMPLETED)

            # ── 3. Image Quality Assessment Checkpoint ────────────────────
            job.update_checkpoint("quality_assessment", CheckpointExecutionState.RUNNING)
            time.sleep(0.15)

            if quality_result.status == AssessmentStatus.RETRY_REQUIRED:
                job.update_checkpoint("quality_assessment", CheckpointExecutionState.FAILED)
                job.overall_status = "QUALITY_RETRY"
                job.outcome = VerificationOutcome.QUALITY_GATEWAY_RETRY_REQUIRED
                reasons_str = ", ".join(r.value for r in quality_result.reasons)
                job.message = f"Quality check requires retry: {reasons_str}."
                self._mark_remaining_skipped(job, ["effort_detection", "gend_detection", "smaug_detection", "fsd_detection", "forensic_summary", "final_result"])
                return

            if quality_result.status == AssessmentStatus.PROCESSING_ERROR:
                job.update_checkpoint("quality_assessment", CheckpointExecutionState.FAILED)
                job.overall_status = "FAILED"
                job.outcome = VerificationOutcome.DETECTION_FAILED
                job.message = f"Quality assessment processing error: {quality_result.message}"
                self._mark_remaining_skipped(job, ["effort_detection", "gend_detection", "smaug_detection", "fsd_detection", "forensic_summary", "final_result"])
                return

            job.update_checkpoint("quality_assessment", CheckpointExecutionState.COMPLETED)

            # Prepare image inputs
            norm_full: Optional[Image.Image] = None
            if quality_result.derivatives and quality_result.derivatives.normalized_image_path:
                p = settings.upload_dir / quality_result.derivatives.normalized_image_path
                if p.exists():
                    norm_full = Image.open(p).convert("RGB")
            if norm_full is None:
                norm_full = Image.open(io.BytesIO(job.raw_bytes)).convert("RGB")

            face_img: Optional[np.ndarray] = None
            if quality_result.derivatives and quality_result.derivatives.face_crop_path:
                cp = settings.upload_dir / quality_result.derivatives.face_crop_path
                if cp.exists():
                    face_img = np.array(Image.open(cp).convert("RGB"))
            if face_img is None:
                face_img = np.array(norm_full)

            # ── 4. EFFORT Face Manipulation Checkpoint ─────────────────────
            if job.include_effort:
                job.update_checkpoint("effort_detection", CheckpointExecutionState.RUNNING)
                job.model_registry["effort"].execution_state = CheckpointExecutionState.RUNNING
                try:
                    effort_adapter = get_effort_adapter()
                    effort_res = effort_adapter.predict(
                        rgb_image=face_img,
                        include_gradcam=job.include_gradcam,
                        input_source_used="face_crop" if face_count > 0 else "full_image",
                    )
                    job.effort_detection = effort_res
                    update_registry_entry(
                        job.model_registry["effort"],
                        status=effort_res.status,
                        duration_ms=effort_res.inference_duration_ms,
                        raw_output={
                            "manipulation_score": effort_res.manipulation_score,
                            "predicted_label": effort_res.predicted_label.value if effort_res.predicted_label else None,
                            "raw_logits": effort_res.raw_logits,
                        },
                        error_message=effort_res.error_message,
                    )
                    job.update_checkpoint(
                        "effort_detection",
                        CheckpointExecutionState.COMPLETED
                        if effort_res.status == ModelInferenceStatus.SUCCESS
                        else CheckpointExecutionState.FAILED,
                    )
                    # Free model weights from RAM to ensure isolation and low memory footprint
                    effort_adapter._model = None
                    import gc; gc.collect()
                except Exception as exc:
                    logger.error("EFFORT execution failed", error=str(exc))
                    job.update_checkpoint("effort_detection", CheckpointExecutionState.FAILED)
            else:
                job.update_checkpoint("effort_detection", CheckpointExecutionState.SKIPPED)

            # ── 5. GenD Face Manipulation Checkpoint ───────────────────────
            if job.include_gend:
                job.update_checkpoint("gend_detection", CheckpointExecutionState.RUNNING)
                job.model_registry["gend"].execution_state = CheckpointExecutionState.RUNNING
                try:
                    gend_adapter = get_gend_adapter()
                    gend_res = gend_adapter.predict(
                        image=face_img,
                        input_source_used="face_crop" if face_count > 0 else "full_image",
                    )
                    job.gend_detection = gend_res
                    update_registry_entry(
                        job.model_registry["gend"],
                        status=gend_res.status,
                        duration_ms=gend_res.inference_duration_ms,
                        raw_output={
                            "genuine_score": gend_res.genuine_score,
                            "fake_score": gend_res.fake_score,
                            "predicted_class": gend_res.predicted_class,
                            "raw_logits": gend_res.raw_logits,
                        },
                        error_message=gend_res.error_message,
                    )
                    job.update_checkpoint(
                        "gend_detection",
                        CheckpointExecutionState.COMPLETED
                        if gend_res.status == ModelInferenceStatus.SUCCESS
                        else CheckpointExecutionState.FAILED,
                    )
                    # Free model weights from RAM
                    gend_adapter._model = None
                    import gc; gc.collect()
                except Exception as exc:
                    logger.error("GenD execution failed", error=str(exc))
                    job.update_checkpoint("gend_detection", CheckpointExecutionState.FAILED)
            else:
                job.update_checkpoint("gend_detection", CheckpointExecutionState.SKIPPED)

            # Update Face Manipulation Agreement immediately
            job.category_agreement["face_manipulation"] = evaluate_face_manipulation_agreement(
                job.effort_detection, job.gend_detection
            )

            # ── 6. Smaug Full-Image AI Generation Checkpoint ───────────────
            if job.include_smaug:
                job.update_checkpoint("smaug_detection", CheckpointExecutionState.RUNNING)
                job.model_registry["smaug"].execution_state = CheckpointExecutionState.RUNNING
                try:
                    smaug_adapter = get_smaug_adapter()
                    smaug_res = smaug_adapter.predict(
                        image=norm_full,
                        crops=settings.smaug_num_crops,
                        input_source_used="normalized_image",
                    )
                    job.smaug_detection = smaug_res
                    update_registry_entry(
                        job.model_registry["smaug"],
                        status=smaug_res.status,
                        duration_ms=smaug_res.inference_duration_ms,
                        raw_output={
                            "ai_generation_score": smaug_res.ai_generation_score,
                            "crop_scores": smaug_res.crop_scores,
                            "predicted_label": smaug_res.predicted_label.value if smaug_res.predicted_label else None,
                        },
                        error_message=smaug_res.error_message,
                    )
                    job.update_checkpoint(
                        "smaug_detection",
                        CheckpointExecutionState.COMPLETED
                        if smaug_res.status == ModelInferenceStatus.SUCCESS
                        else CheckpointExecutionState.FAILED,
                    )
                    # Free model weights from RAM
                    smaug_adapter._model = None
                    import gc; gc.collect()
                except Exception as exc:
                    logger.error("Smaug execution failed", error=str(exc))
                    job.update_checkpoint("smaug_detection", CheckpointExecutionState.FAILED)
            else:
                job.update_checkpoint("smaug_detection", CheckpointExecutionState.SKIPPED)

            # ── 7. FSD Forensic AI Generation Checkpoint ───────────────────
            if job.include_fsd:
                job.update_checkpoint("fsd_detection", CheckpointExecutionState.RUNNING)
                job.model_registry["fsd"].execution_state = CheckpointExecutionState.RUNNING
                try:
                    fsd_adapter = get_fsd_adapter()
                    fsd_res = fsd_adapter.predict(image=norm_full)
                    job.fsd_detection = fsd_res
                    update_registry_entry(
                        job.model_registry["fsd"],
                        status=fsd_res.status,
                        duration_ms=fsd_res.inference_duration_ms,
                        raw_output={
                            "native_z_score": fsd_res.native_z_score,
                            "raw_score": fsd_res.raw_score,
                            "is_fake": fsd_res.is_fake,
                            "model_derived_decision": fsd_res.model_derived_decision,
                        },
                        error_message=fsd_res.error_message,
                    )
                    if fsd_res.status == ModelInferenceStatus.SKIPPED:
                        job.update_checkpoint("fsd_detection", CheckpointExecutionState.SKIPPED)
                    elif fsd_res.status == ModelInferenceStatus.SUCCESS:
                        job.update_checkpoint("fsd_detection", CheckpointExecutionState.COMPLETED)
                    else:
                        job.update_checkpoint("fsd_detection", CheckpointExecutionState.FAILED)
                    # Free model weights from RAM
                    fsd_adapter._detector = None
                    import gc; gc.collect()
                except Exception as exc:
                    logger.error("FSD execution failed", error=str(exc))
                    job.update_checkpoint("fsd_detection", CheckpointExecutionState.FAILED)
            else:
                job.update_checkpoint("fsd_detection", CheckpointExecutionState.SKIPPED)

            # Update AI Generation Agreement immediately
            job.category_agreement["ai_generation"] = evaluate_ai_generation_agreement(
                job.smaug_detection, job.fsd_detection
            )

            # ── 8. Forensic Analysis Summary Checkpoint ────────────────────
            job.update_checkpoint("forensic_summary", CheckpointExecutionState.RUNNING)
            if job.include_forensics and norm_full is not None:
                try:
                    forensic_service = get_forensic_service()
                    det_fmt = (
                        quality_result.file_metadata.detected_format
                        if quality_result.file_metadata
                        else "UNKNOWN"
                    )
                    job.forensic_report = forensic_service.generate_forensic_report(
                        rgb_image=np.array(norm_full),
                        evidence_id=quality_result.evidence_id,
                        detected_format=det_fmt,
                        detected_faces=quality_result.faces,
                        sha256=quality_result.sha256,
                    )
                except Exception as exc:
                    logger.warning("Forensic analysis suite failed", error=str(exc))
            time.sleep(0.15)
            job.update_checkpoint("forensic_summary", CheckpointExecutionState.COMPLETED)

            # ── 9. Final Result Preparation Checkpoint ─────────────────────
            job.update_checkpoint("final_result", CheckpointExecutionState.RUNNING)

            # Construct summary message
            messages = []
            if job.effort_detection and job.effort_detection.status == ModelInferenceStatus.SUCCESS:
                messages.append(f"EFFORT: {job.effort_detection.manipulation_score:.3f}")
            if job.gend_detection and job.gend_detection.status == ModelInferenceStatus.SUCCESS:
                messages.append(f"GenD: {job.gend_detection.fake_score:.3f}")
            if job.smaug_detection and job.smaug_detection.status == ModelInferenceStatus.SUCCESS:
                messages.append(f"Smaug: {job.smaug_detection.ai_generation_score:.3f}")
            if job.fsd_detection and job.fsd_detection.status == ModelInferenceStatus.SUCCESS:
                messages.append(f"FSD z-score: {job.fsd_detection.native_z_score:.2f}")

            job.overall_status = "COMPLETED"
            job.outcome = VerificationOutcome.VERIFIED
            job.message = f"Four-model forensic verification complete. {'; '.join(messages)}."
            time.sleep(0.1)
            job.update_checkpoint("final_result", CheckpointExecutionState.COMPLETED)

        except Exception as exc:
            logger.error("Job runner catastrophic failure", error=str(exc))
            job.overall_status = "FAILED"
            job.outcome = VerificationOutcome.DETECTION_FAILED
            job.message = f"Pipeline execution failed: {exc}"
            job.error_message = str(exc)

    def _mark_remaining_skipped(self, job: VerificationJob, keys: List[str]):
        for k in keys:
            job.update_checkpoint(k, CheckpointExecutionState.SKIPPED)


_job_manager_instance: Optional[VerificationJobManager] = None


def get_job_manager() -> VerificationJobManager:
    global _job_manager_instance
    if _job_manager_instance is None:
        _job_manager_instance = VerificationJobManager()
    return _job_manager_instance
