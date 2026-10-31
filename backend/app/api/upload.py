"""
ShieldHer – POST /upload endpoint for image ingestion and forensic quality assessment.
"""
from __future__ import annotations

from fastapi import APIRouter, File, Response, UploadFile, status
import structlog

from app.schemas.upload import AssessmentStatus, UploadResponse
from app.services.image_processor import get_image_processor

router = APIRouter(tags=["upload"])
logger = structlog.get_logger(__name__)


@router.post(
    "/upload",
    response_model=UploadResponse,
    summary="Upload image and perform forensic quality assessment",
    description=(
        "Ingests an evidence image, verifies file signatures and integrity, computes "
        "SHA-256 hash of original file, non-destructively transposes EXIF orientation, "
        "runs MediaPipe Face Detector, computes blur/sharpness, brightness and contrast, "
        "and evaluates results against provisional quality thresholds."
    ),
    responses={
        200: {"model": UploadResponse, "description": "Assessment completed (PASS or RETRY_REQUIRED)"},
        400: {"model": UploadResponse, "description": "Unsupported input (invalid signature, corrupt, empty)"},
        500: {"model": UploadResponse, "description": "Processing failure"},
    },
)
async def upload_image(
    response: Response,
    file: UploadFile = File(..., description="Image evidence file (JPEG, PNG, WEBP)"),
) -> UploadResponse:
    processor = get_image_processor()

    # Read uploaded bytes
    try:
        raw_bytes = await file.read()
    except Exception as exc:
        logger.error("Failed to read uploaded file stream", error=str(exc))
        response.status_code = status.HTTP_400_BAD_REQUEST
        thresholds = processor.get_provisional_thresholds()
        return UploadResponse(
            status=AssessmentStatus.UNSUPPORTED_INPUT,
            reasons=[],
            message=f"Failed to read upload stream: {exc}",
            evidence_id="",
            thresholds=thresholds,
        )

    # Process and evaluate evidence
    result = processor.process_upload(
        raw_bytes=raw_bytes,
        filename=file.filename,
        content_type=file.content_type,
    )

    # Set appropriate HTTP status code while preserving the structured UploadResponse schema
    if result.status == AssessmentStatus.UNSUPPORTED_INPUT:
        response.status_code = status.HTTP_400_BAD_REQUEST
    elif result.status == AssessmentStatus.PROCESSING_ERROR:
        response.status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
    else:
        response.status_code = status.HTTP_200_OK

    return result
