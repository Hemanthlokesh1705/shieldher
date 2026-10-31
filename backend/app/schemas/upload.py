"""
ShieldHer – Schemas for Image Upload & Forensic Quality Assessment.
"""
from __future__ import annotations

from enum import Enum
from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class AssessmentStatus(str, Enum):
    PASS = "PASS"
    RETRY_REQUIRED = "RETRY_REQUIRED"
    UNSUPPORTED_INPUT = "UNSUPPORTED_INPUT"
    PROCESSING_ERROR = "PROCESSING_ERROR"


class ReasonCode(str, Enum):
    # Assessment reasons
    NO_FACE_DETECTED = "NO_FACE_DETECTED"
    BLURRY_IMAGE = "BLURRY_IMAGE"
    UNDER_EXPOSED = "UNDER_EXPOSED"
    OVER_EXPOSED = "OVER_EXPOSED"
    LOW_CONTRAST = "LOW_CONTRAST"
    LOW_RESOLUTION = "LOW_RESOLUTION"
    FACE_TOO_SMALL = "FACE_TOO_SMALL"
    # Input validation reasons
    EMPTY_FILE = "EMPTY_FILE"
    FILE_TOO_LARGE = "FILE_TOO_LARGE"
    UNSUPPORTED_MAGIC_BYTES = "UNSUPPORTED_MAGIC_BYTES"
    DECODING_FAILED = "DECODING_FAILED"
    EXCEEDS_PIXEL_LIMIT = "EXCEEDS_PIXEL_LIMIT"
    PROCESSING_FAILURE = "PROCESSING_FAILURE"


class KeypointInfo(BaseModel):
    name: str = Field(description="Anatomical landmark name (e.g. right_eye, left_eye, nose_tip)")
    x: float = Field(description="Normalized X coordinate in range [0, 1]")
    y: float = Field(description="Normalized Y coordinate in range [0, 1]")
    score: Optional[float] = Field(default=None, description="Landmark confidence score if provided")


class BoundingBox(BaseModel):
    origin_x: int = Field(description="Pixel X coordinate of top-left corner")
    origin_y: int = Field(description="Pixel Y coordinate of top-left corner")
    width: int = Field(description="Bounding box width in pixels")
    height: int = Field(description="Bounding box height in pixels")
    normalized_xmin: float = Field(description="Normalized left coordinate [0, 1]")
    normalized_ymin: float = Field(description="Normalized top coordinate [0, 1]")
    normalized_width: float = Field(description="Normalized width [0, 1]")
    normalized_height: float = Field(description="Normalized height [0, 1]")


class ImageDimensions(BaseModel):
    width: int
    height: int
    channels: int
    aspect_ratio: float
    total_pixels: int


class CropDimensions(BaseModel):
    crop_width: int
    crop_height: int
    aspect_ratio: float


class QualityMetrics(BaseModel):
    blur_score: float = Field(description="Laplacian variance metric; higher indicates greater edge sharpness")
    brightness: float = Field(description="Mean luminance on 0-255 scale")
    contrast: float = Field(description="Luminance standard deviation on 0-255 scale")
    is_sharp: bool
    is_well_exposed: bool
    has_acceptable_contrast: bool


class DetectedFace(BaseModel):
    face_index: int
    bounding_box: BoundingBox
    confidence: float = Field(description="Detector confidence score [0.0 - 1.0]")
    keypoints: List[KeypointInfo]
    crop_dimensions: Optional[CropDimensions] = None
    crop_quality: Optional[QualityMetrics] = None


class ProvisionalThresholds(BaseModel):
    is_provisional: bool = Field(
        default=True,
        description=(
            "PROVISIONAL: Thresholds are initial heuristic engineering baselines and "
            "MUST be calibrated against representative NCII forensic datasets prior "
            "to evidentiary reliance."
        ),
    )
    calibration_status: str = "PROVISIONAL_PENDING_FORENSIC_DATASET_CALIBRATION"
    min_image_width: int
    min_image_height: int
    max_image_pixels: int
    min_face_width: int
    min_face_height: int
    min_sharpness_score: float
    min_brightness: float
    max_brightness: float
    min_contrast: float
    min_face_confidence: float


class FileMetadata(BaseModel):
    filename: Optional[str]
    size_bytes: int
    mime_type: Optional[str]
    detected_format: Optional[str]
    exif_orientation_corrected: bool = Field(
        description="Whether EXIF orientation transpose was applied. Missing EXIF does not cause rejection."
    )


class EvidenceDerivatives(BaseModel):
    normalized_image_path: Optional[str] = Field(
        default=None,
        description="Relative storage path of orientation-corrected standard RGB derivative",
    )
    face_crop_path: Optional[str] = Field(
        default=None,
        description="Relative storage path of primary isolated face crop derivative",
    )


class UploadResponse(BaseModel):
    status: AssessmentStatus = Field(
        description="Structured outcome: PASS, RETRY_REQUIRED, UNSUPPORTED_INPUT, PROCESSING_ERROR"
    )
    reasons: List[ReasonCode] = Field(
        default_factory=list,
        description="Detailed machine-readable reason codes (e.g. NO_FACE_DETECTED, BLURRY_IMAGE)",
    )
    message: str = Field(description="Human-readable assessment summary")
    evidence_id: str = Field(description="Unique UUID for this evidence submission")
    sha256: Optional[str] = Field(
        default=None,
        description="Cryptographic SHA-256 hash of the original unmodified byte stream",
    )
    file_metadata: Optional[FileMetadata] = None
    image_dimensions: Optional[ImageDimensions] = None
    quality_metrics: Optional[QualityMetrics] = None
    face_count: int = Field(default=0, description="Total faces detected by MediaPipe detector")
    faces: List[DetectedFace] = Field(default_factory=list)
    derivatives: Optional[EvidenceDerivatives] = None
    thresholds: ProvisionalThresholds
