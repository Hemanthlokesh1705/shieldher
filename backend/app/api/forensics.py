"""
ShieldHer – POST /analyze/forensics endpoint.

Executes deterministic image forensics using OpenCV, NumPy, SciPy, and PyWavelets:
- 2D FFT & radial energy decomposition (low, mid, high frequency bands).
- 2D block DCT energy distribution.
- 2D Haar DWT subband energy ratios.
- High-pass and median filter denoising residuals with moment statistics.
- Fan & de Queiroz 8x8 JPEG blockiness and Error Level Analysis (ELA) for JPEG uploads.
- Gallagher-Chen periodic second-difference resampling peak analysis.
- Face boundary texture discontinuity and LAB Delta E color seam analysis.
- Strict evidentiary PRNU and optional model (FSD, TruFor) disclosures.
"""
from __future__ import annotations

import io
from pathlib import Path
from fastapi import APIRouter, File, HTTPException, Response, UploadFile, status
from PIL import Image
import numpy as np
import structlog

from app.config import get_settings
from app.schemas.forensics import AnalysisExecutionStatus, ForensicReport
from app.schemas.upload import AssessmentStatus
from app.services.forensic_service import get_forensic_service
from app.services.image_processor import get_image_processor

router = APIRouter(tags=["forensics"])
logger = structlog.get_logger(__name__)


@router.post(
    "/analyze/forensics",
    response_model=ForensicReport,
    summary="Run deterministic forensic image analysis",
    description=(
        "Executes mathematical and signal-processing forensic analyses: "
        "2D FFT frequency bands, block DCT, 2D DWT wavelets, noise residuals, "
        "JPEG blockiness / ELA (for JPEG), resampling indicators, and face boundary seams. "
        "Measurements provide physical consistency clues, not fake probabilities."
    ),
    responses={
        200: {"model": ForensicReport, "description": "Forensic analysis completed"},
        400: {"description": "Invalid image file or decoding failure"},
    },
)
@router.post(
    "/analyze-forensics",
    response_model=ForensicReport,
    include_in_schema=False,
)
async def analyze_image_forensics(
    response: Response,
    file: UploadFile = File(..., description="Evidence image file to analyze"),
) -> ForensicReport:
    processor = get_image_processor()
    forensic_service = get_forensic_service()

    # 1. Read bytes
    try:
        raw_bytes = await file.read()
    except Exception as exc:
        logger.error("Failed to read upload stream", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to read upload stream: {exc}",
        )

    # 2. Ingest through quality processor for validation & face detection
    quality_result = processor.process_upload(
        raw_bytes=raw_bytes,
        filename=file.filename,
        content_type=file.content_type,
    )

    if quality_result.status == AssessmentStatus.UNSUPPORTED_INPUT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=quality_result.message or "Unsupported or corrupt image file.",
        )

    # 3. Decode RGB image
    try:
        pil_img = Image.open(io.BytesIO(raw_bytes)).convert("RGB")
        rgb_arr = np.array(pil_img)
    except Exception as exc:
        logger.error("Failed to decode uploaded image", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not decode image file: {exc}",
        )

    detected_format = (
        quality_result.file_metadata.detected_format
        if quality_result.file_metadata and quality_result.file_metadata.detected_format
        else "UNKNOWN"
    )
    faces = quality_result.faces

    try:
        report = forensic_service.generate_forensic_report(
            rgb_image=rgb_arr,
            evidence_id=quality_result.evidence_id or "evidence",
            detected_format=detected_format,
            detected_faces=faces,
            sha256=quality_result.sha256,
        )
    except Exception as exc:
        logger.error("Forensic analysis generation failed", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Forensic computation failed: {exc}",
        )

    return report
