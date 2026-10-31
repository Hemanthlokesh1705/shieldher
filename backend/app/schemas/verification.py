"""
ShieldHer – Schemas for Face Manipulation & Face-Swap Verification (Effort Model).
"""
from __future__ import annotations

from enum import Enum
from typing import Dict, List, Optional
from pydantic import BaseModel, Field

from app.schemas.upload import UploadResponse
from app.schemas.forensics import ForensicReport


class ModelInferenceStatus(str, Enum):
    SUCCESS = "SUCCESS"
    UNAVAILABLE = "UNAVAILABLE"
    DEPENDENCY_MISSING = "DEPENDENCY_MISSING"
    INCOMPATIBLE_WEIGHTS = "INCOMPATIBLE_WEIGHTS"
    ERROR = "ERROR"


class VerificationOutcome(str, Enum):
    VERIFIED = "VERIFIED"
    QUALITY_GATEWAY_REJECTED = "QUALITY_GATEWAY_REJECTED"
    QUALITY_GATEWAY_RETRY_REQUIRED = "QUALITY_GATEWAY_RETRY_REQUIRED"
    DETECTOR_UNAVAILABLE = "DETECTOR_UNAVAILABLE"
    DETECTION_FAILED = "DETECTION_FAILED"


class PredictedLabel(str, Enum):
    MANIPULATED = "MANIPULATED"
    AUTHENTIC = "AUTHENTIC"


class GradCamResult(BaseModel):
    has_gradcam: bool = Field(description="Whether Grad-CAM activation map was computed")
    target_class: int = Field(default=1, description="Class index (1 = Manipulated)")
    target_layer: str = Field(description="Architecture layer hooked for gradient extraction")
    heatmap_dimensions: List[int] = Field(description="[height, width] of the generated heatmap")
    heatmap_grid: Optional[List[List[float]]] = Field(
        default=None,
        description="2D normalized activation map in range [0.0, 1.0]",
    )
    overlay_base64_png: Optional[str] = Field(
        default=None,
        description="Optional base64-encoded visual heatmap overlay on the face crop",
    )


class DetectionDetails(BaseModel):
    model_name: str = "Effort-AIGI-Detection (CLIP-ViT-L/14)"
    checkpoint_identifier: str = "effort_clip_l14_faceforensics_pp_c23"
    official_repo: str = "https://github.com/YZY-stack/Effort-AIGI-Detection"
    paper_reference: str = "Orthogonal Subspace Decomposition for Generalizable AI-Generated Image Detection (ICML 2025 Oral)"
    license: str = "CC BY-NC 4.0"
    status: ModelInferenceStatus
    inference_duration_ms: Optional[float] = None
    raw_logits: Optional[List[float]] = Field(
        default=None,
        description="Raw output logits [logit_real (class 0), logit_fake (class 1)]",
    )
    manipulation_score: Optional[float] = Field(
        default=None,
        description="Softmax output for class 1 (manipulated/face-swapped) in range [0.0, 1.0]",
    )
    predicted_label: Optional[PredictedLabel] = None
    score_semantics: str = Field(
        default=(
            "UNSCALED_HEURISTIC_SCORE: Output reflects the binary classification softmax "
            "probability for class 1 (manipulated/face-swapped) under the FaceForensics++ benchmark. "
            "Raw scores must NOT be interpreted as certified posterior probabilities of manipulation "
            "without domain-specific calibration."
        ),
        description="Documented legal and evidentiary interpretation of the model score",
    )
    error_message: Optional[str] = None
    gradcam: Optional[GradCamResult] = None
    input_source_used: Optional[str] = Field(
        default=None,
        description="'face_crop' if an isolated face crop was processed, or 'full_image'",
    )


class SmaugPredictedLabel(str, Enum):
    AI_GENERATED = "AI_GENERATED"
    NATURAL_OR_AUTHENTIC = "NATURAL_OR_AUTHENTIC"


class SmaugDetectionDetails(BaseModel):
    model_name: str = "Smaug-AI-Image-Detector"
    checkpoint_identifier: str = "abacusai/Smaug-AI-Image-Detector"
    official_repo: str = "https://huggingface.co/abacusai/Smaug-AI-Image-Detector"
    architecture: str = "Vision-only EmbeddingGemma-2 + linear classifier (439M parameters)"
    license: str = "Apache-2.0"
    status: ModelInferenceStatus
    inference_duration_ms: Optional[float] = None
    ai_generation_score: Optional[float] = Field(
        default=None,
        description="Averaged crop sigmoid score in range [0.0, 1.0] for the AI-generated hypothesis",
    )
    crop_scores: Optional[List[float]] = Field(
        default=None,
        description="Individual raw sigmoid scores for each 528x528 crop evaluated",
    )
    crops_evaluated: Optional[int] = Field(
        default=None,
        description="Number of crops evaluated (typically 3: start, center, end along long axis)",
    )
    predicted_label: Optional[SmaugPredictedLabel] = None
    score_semantics: str = Field(
        default=(
            "UNSCALED_HEURISTIC_SCORE: Output reflects the binary classification sigmoid probability "
            "from the fine-tuned vision-only EmbeddingGemma-2 model evaluating the full image at native resolution. "
            "Raw scores must NOT be interpreted as certified posterior probabilities of synthesis. "
            "Furthermore, full-image AI generation is not interchangeable with face-swap detection: "
            "an authentic photograph with a swapped face may score low here, while a fully synthesized image "
            "with no real victim may score high."
        ),
        description="Documented forensic and evidentiary interpretation of the model score",
    )
    error_message: Optional[str] = None
    input_source_used: Optional[str] = Field(
        default=None,
        description="'full_image' (standard for Smaug) or derivative path used",
    )


class VerificationResponse(BaseModel):
    verification_status: VerificationOutcome
    message: str
    evidence_id: str
    sha256: Optional[str] = None
    quality_assessment: UploadResponse
    # Effort-AIGI-Detection (Face manipulation & Face swap)
    effort_detection: Optional[DetectionDetails] = None
    # Smaug-AI-Image-Detector (Full-image AI generation)
    smaug_detection: Optional[SmaugDetectionDetails] = None
    # Backward compatibility alias
    detection: Optional[DetectionDetails] = None
    # Optional deterministic forensic analysis
    forensic_report: Optional[ForensicReport] = None
