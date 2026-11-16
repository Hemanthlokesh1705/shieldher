"""
ShieldHer – Schemas for Face Manipulation & Face-Swap Verification (Effort Model).
"""
from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from app.schemas.upload import UploadResponse
from app.schemas.forensics import ForensicReport


class ModelInferenceStatus(str, Enum):
    SUCCESS = "SUCCESS"
    UNAVAILABLE = "UNAVAILABLE"
    DEPENDENCY_MISSING = "DEPENDENCY_MISSING"
    INCOMPATIBLE_WEIGHTS = "INCOMPATIBLE_WEIGHTS"
    SKIPPED = "SKIPPED"
    ERROR = "ERROR"


class CheckpointExecutionState(str, Enum):
    NOT_STARTED = "NOT_STARTED"
    QUEUED = "QUEUED"
    INITIALIZING = "INITIALIZING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    UNAVAILABLE = "UNAVAILABLE"
    SKIPPED = "SKIPPED"


class ModelCategory(str, Enum):
    FACE_MANIPULATION = "FACE_MANIPULATION"
    AI_GENERATED_IMAGE = "AI_GENERATED_IMAGE"


class AgreementStatus(str, Enum):
    MODEL_AGREEMENT = "MODEL_AGREEMENT"
    MODEL_DISAGREEMENT = "MODEL_DISAGREEMENT"
    POSSIBLE_MANIPULATION = "POSSIBLE_MANIPULATION"
    INCONCLUSIVE = "INCONCLUSIVE"
    INSUFFICIENT_EVIDENCE = "INSUFFICIENT_EVIDENCE"


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


class GenDDetectionDetails(BaseModel):
    model_name: str = "GenD (CLIP-ViT-L/14)"
    model_version: str = "1.0"
    checkpoint_id: str = "yermandy/GenD_CLIP_L_14"
    official_repo: str = "https://github.com/yermandy/GenD"
    paper_reference: str = "Deepfake Detection that Generalizes Across Benchmarks (WACV 2026)"
    license: str = "MIT"
    status: ModelInferenceStatus
    raw_logits: Optional[List[float]] = Field(
        default=None,
        description="Raw output logits [logit_authentic (class 0), logit_manipulated (class 1)]",
    )
    class_scores: Optional[Dict[str, float]] = Field(
        default=None,
        description="Softmax class probabilities: {'authentic': p0, 'manipulated': p1}",
    )
    genuine_score: Optional[float] = Field(
        default=None,
        description="Probability that input face is authentic (class 0)",
    )
    fake_score: Optional[float] = Field(
        default=None,
        description="Probability that input face is manipulated / deepfake (class 1)",
    )
    predicted_class: Optional[str] = Field(
        default=None,
        description="'authentic' or 'manipulated'",
    )
    inference_duration_ms: Optional[float] = None
    device_used: str = "cpu"
    preprocessing_version: str = "CLIPProcessor_224x224_norm"
    input_source_used: Optional[str] = Field(
        default=None,
        description="'face_crop' or 'full_image_fallback'",
    )
    score_semantics: str = Field(
        default=(
            "UNSCALED_HEURISTIC_SCORE: GenD outputs normalized linear probe logits over frozen "
            "CLIP-ViT-L/14 embeddings. Class 0 represents authentic imagery and Class 1 represents deepfakes. "
            "Softmax outputs indicate uncalibrated classification confidence across cross-dataset benchmarks."
        ),
        description="Legal and forensic interpretation of GenD score",
    )
    error_message: Optional[str] = None


class FSDDetectionDetails(BaseModel):
    model_name: str = "Forensic-Self-Descriptions (FSD)"
    model_version: str = "1.2.0"
    checkpoint_id: str = "ductai199x/Forensic-Self-Descriptions-CVPR25"
    official_repo: str = "https://github.com/ductai199x/Forensic-Self-Descriptions-CVPR25"
    paper_reference: str = "Forensic Self-Descriptions Are All You Need for Zero-Shot Detection, Open-Set Source Attribution, and Clustering of AI-generated Images (CVPR 2025)"
    license: str = "CC BY-NC-SA 4.0 Non-Commercial Research License"
    status: ModelInferenceStatus
    native_z_score: Optional[float] = Field(
        default=None,
        description="Native GMM normalized z-score. More negative values indicate AI-generated residual deviation.",
    )
    raw_score: Optional[float] = Field(
        default=None,
        description="Raw GMM log-likelihood before z-score normalization.",
    )
    is_fake: Optional[bool] = Field(
        default=None,
        description="Native model classification decision based on documented threshold.",
    )
    threshold_used: float = Field(
        default=-2.0,
        description="Documented z-score threshold (default -2.0; z < -2.0 is flagged as AI-generated).",
    )
    model_derived_decision: Optional[str] = Field(
        default=None,
        description="'AI_GENERATED' or 'AUTHENTIC'",
    )
    documented_score_interpretation: str = Field(
        default=(
            "FORENSIC_Z_SCORE: The FSD model evaluates intrinsic pixel-level prediction-error residuals (FRE) "
            "modeled with a Gaussian Mixture Model trained exclusively on natural images. "
            "Negative z-scores indicate deviation from natural camera sensor noise. "
            "By documented standard: z > -2.0 indicates authentic photographic residuals; "
            "z < -2.0 indicates AI-generated residuals; z < -3.0 indicates strong synthetic divergence."
        ),
        description="Documented interpretation of native FSD forensic residual score",
    )
    inference_duration_ms: Optional[float] = None
    device_used: str = "cpu"
    licensing_notice: str = "Non-commercial research use only under CC BY-NC-SA 4.0 license"
    error_message: Optional[str] = None


class CategoryAgreement(BaseModel):
    category: ModelCategory
    status: AgreementStatus
    summary: str
    details: str
    models_participating: List[str]
    models_flagged: List[str]
    confidence_assessment: str


class ModelRegistryEntry(BaseModel):
    model_id: str
    model_name: str
    category: ModelCategory
    checkpoint_identifier: str
    version: str
    license: str
    availability_status: str
    execution_state: CheckpointExecutionState
    score_semantics: str
    execution_duration_ms: Optional[float] = None
    raw_output: Optional[Dict[str, Any]] = None
    error_details: Optional[str] = None


class VerificationResponse(BaseModel):
    verification_status: VerificationOutcome
    message: str
    evidence_id: str
    verification_id: Optional[str] = None
    sha256: Optional[str] = None
    quality_assessment: UploadResponse

    # Four-Model Suite:
    # 1. Face Manipulation
    effort_detection: Optional[DetectionDetails] = None
    gend_detection: Optional[GenDDetectionDetails] = None

    # 2. Full-Image AI Generation
    smaug_detection: Optional[SmaugDetectionDetails] = None
    fsd_detection: Optional[FSDDetectionDetails] = None

    # Backward compatibility alias
    detection: Optional[DetectionDetails] = None

    # Four-Model Architecture Artifacts
    checkpoints: Optional[Dict[str, CheckpointExecutionState]] = None
    model_registry: Optional[Dict[str, ModelRegistryEntry]] = None
    category_agreement: Optional[Dict[str, CategoryAgreement]] = None
    results: Optional[Dict[str, Any]] = None

    # Optional deterministic forensic analysis
    forensic_report: Optional[ForensicReport] = None
