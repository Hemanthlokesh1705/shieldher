"""
ShieldHer – Four-Model Registry & Category Agreement Service.

Maintains the standardized registry of the four forensic models:
1. EFFORT: Face Manipulation (CLIP-ViT-L/14 with SVD Residuals, ICML 2025)
2. GenD: Face Manipulation (CLIP-ViT-L/14 LinearNorm, WACV 2026)
3. Smaug: AI-Generated Image (EmbeddingGemma-2, Abacus.AI)
4. FSD: AI-Generated Image (Forensic Self-Descriptions GMM, CVPR 2025)

Implements rigorous forensic agreement and disagreement logic:
- Never blindly averages raw heterogeneous model outputs.
- Evaluates Face Manipulation and AI Generation separately.
- Emits transparent agreement statuses:
  MODEL_AGREEMENT, MODEL_DISAGREEMENT, POSSIBLE_MANIPULATION, INCONCLUSIVE, INSUFFICIENT_EVIDENCE.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple
import structlog

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
    SmaugPredictedLabel,
)

logger = structlog.get_logger(__name__)


MODEL_SPECS: Dict[str, Dict[str, Any]] = {
    "effort": {
        "model_id": "effort",
        "model_name": "Effort-AIGI-Detection",
        "category": ModelCategory.FACE_MANIPULATION,
        "checkpoint_identifier": "effort_clip_l14_faceforensics_pp_c23",
        "version": "1.0-icml2025",
        "license": "CC BY-NC 4.0",
        "score_semantics": (
            "Softmax probability for class 1 (manipulated/face-swapped) under FaceForensics++ benchmark. "
            "Threshold: 0.50. Evaluates face crop."
        ),
    },
    "gend": {
        "model_id": "gend",
        "model_name": "GenD (CLIP-ViT-L/14)",
        "category": ModelCategory.FACE_MANIPULATION,
        "checkpoint_identifier": "yermandy/GenD_CLIP_L_14",
        "version": "1.0-wacv2026",
        "license": "MIT",
        "score_semantics": (
            "Linear probe classification logits and softmax probabilities [authentic (0), manipulated (1)]. "
            "Threshold: 0.50. Evaluates face crop."
        ),
    },
    "smaug": {
        "model_id": "smaug",
        "model_name": "Smaug-AI-Image-Detector",
        "category": ModelCategory.AI_GENERATED_IMAGE,
        "checkpoint_identifier": "abacusai/Smaug-AI-Image-Detector",
        "version": "1.0-embedding-gemma-2",
        "license": "Apache-2.0",
        "score_semantics": (
            "Sigmoid probability from 3 native-resolution 528x528 crops evaluated across full image. "
            "Threshold: 0.50. Evaluates full scene."
        ),
    },
    "fsd": {
        "model_id": "fsd",
        "model_name": "Forensic-Self-Descriptions (FSD)",
        "category": ModelCategory.AI_GENERATED_IMAGE,
        "checkpoint_identifier": "ductai199x/Forensic-Self-Descriptions-CVPR25",
        "version": "1.2.0-cvpr2025",
        "license": "CC BY-NC-SA 4.0 (Non-Commercial Research Use Only)",
        "score_semantics": (
            "Native FRE residual log-likelihood z-score evaluated with natural image GMM. "
            "Documented threshold: -2.0 (z < -2.0 flags synthetic residual patterns). Evaluates full image."
        ),
    },
}


def build_initial_registry(
    enabled_models: Optional[List[str]] = None,
) -> Dict[str, ModelRegistryEntry]:
    """
    Constructs the initial model registry with NOT_STARTED / QUEUED states.
    """
    enabled = enabled_models or ["effort", "gend", "smaug", "fsd"]
    registry: Dict[str, ModelRegistryEntry] = {}

    for mid, spec in MODEL_SPECS.items():
        is_enabled = mid in enabled
        registry[mid] = ModelRegistryEntry(
            model_id=spec["model_id"],
            model_name=spec["model_name"],
            category=spec["category"],
            checkpoint_identifier=spec["checkpoint_identifier"],
            version=spec["version"],
            license=spec["license"],
            availability_status="AVAILABLE" if is_enabled else "DISABLED",
            execution_state=(
                CheckpointExecutionState.QUEUED if is_enabled else CheckpointExecutionState.SKIPPED
            ),
            score_semantics=spec["score_semantics"],
            execution_duration_ms=None,
            raw_output=None,
            error_details=None if is_enabled else "Model omitted or disabled by user request",
        )

    return registry


def update_registry_entry(
    entry: ModelRegistryEntry,
    status: ModelInferenceStatus,
    duration_ms: Optional[float] = None,
    raw_output: Optional[Dict[str, Any]] = None,
    error_message: Optional[str] = None,
) -> ModelRegistryEntry:
    """
    Updates a model registry entry with final execution results.
    """
    state_map = {
        ModelInferenceStatus.SUCCESS: CheckpointExecutionState.COMPLETED,
        ModelInferenceStatus.UNAVAILABLE: CheckpointExecutionState.UNAVAILABLE,
        ModelInferenceStatus.DEPENDENCY_MISSING: CheckpointExecutionState.UNAVAILABLE,
        ModelInferenceStatus.INCOMPATIBLE_WEIGHTS: CheckpointExecutionState.FAILED,
        ModelInferenceStatus.SKIPPED: CheckpointExecutionState.SKIPPED,
        ModelInferenceStatus.ERROR: CheckpointExecutionState.FAILED,
    }

    entry.execution_state = state_map.get(status, CheckpointExecutionState.FAILED)
    entry.availability_status = status.value
    entry.execution_duration_ms = duration_ms
    entry.raw_output = raw_output
    entry.error_details = error_message
    return entry


def evaluate_face_manipulation_agreement(
    effort: Optional[DetectionDetails],
    gend: Optional[GenDDetectionDetails],
) -> CategoryAgreement:
    """
    Evaluates agreement between EFFORT and GenD for face manipulation.
    """
    models_participating: List[str] = []
    models_flagged: List[str] = []

    effort_valid = effort is not None and effort.status == ModelInferenceStatus.SUCCESS
    gend_valid = gend is not None and gend.status == ModelInferenceStatus.SUCCESS

    effort_flagged = False
    if effort_valid and effort is not None and effort.manipulation_score is not None:
        models_participating.append("Effort-AIGI-Detection")
        if effort.manipulation_score >= 0.50:
            effort_flagged = True
            models_flagged.append("Effort-AIGI-Detection")

    gend_flagged = False
    if gend_valid and gend is not None and gend.fake_score is not None:
        models_participating.append("GenD (CLIP-ViT-L/14)")
        if gend.fake_score >= 0.50:
            gend_flagged = True
            models_flagged.append("GenD (CLIP-ViT-L/14)")

    if len(models_participating) == 0:
        return CategoryAgreement(
            category=ModelCategory.FACE_MANIPULATION,
            status=AgreementStatus.INSUFFICIENT_EVIDENCE,
            summary="Face manipulation detectors could not be executed.",
            details="Neither EFFORT nor GenD produced a valid score (checkpoints may be unavailable or no face detected).",
            models_participating=[],
            models_flagged=[],
            confidence_assessment="INSUFFICIENT_EVIDENCE",
        )

    if len(models_participating) == 1:
        single_name = models_participating[0]
        is_single_flagged = len(models_flagged) == 1
        status = AgreementStatus.POSSIBLE_MANIPULATION if is_single_flagged else AgreementStatus.INCONCLUSIVE
        summary = (
            f"Only {single_name} evaluated face boundaries. "
            f"Result: {'manipulation signals detected' if is_single_flagged else 'no manipulation signals detected'}."
        )
        details = (
            f"Independent cross-validation with a second face manipulation model was unavailable. "
            f"Single-detector verdict should be reviewed cautiously."
        )
        return CategoryAgreement(
            category=ModelCategory.FACE_MANIPULATION,
            status=status,
            summary=summary,
            details=details,
            models_participating=models_participating,
            models_flagged=models_flagged,
            confidence_assessment="MODERATE_SINGLE_MODEL",
        )

    # Both models evaluated: check agreement
    if effort_flagged and gend_flagged:
        return CategoryAgreement(
            category=ModelCategory.FACE_MANIPULATION,
            status=AgreementStatus.MODEL_AGREEMENT,
            summary="Both face-manipulation models (EFFORT & GenD) flag potential manipulation artifacts.",
            details=(
                f"EFFORT indicated manipulation score {effort.manipulation_score:.3f} and "
                f"GenD indicated deepfake probability {gend.fake_score:.3f}. "
                "Concordance across both architectures strengthens evidence of localized face manipulation or swapping."
            ),
            models_participating=models_participating,
            models_flagged=models_flagged,
            confidence_assessment="HIGH_CONCORDANCE",
        )

    if (not effort_flagged) and (not gend_flagged):
        return CategoryAgreement(
            category=ModelCategory.FACE_MANIPULATION,
            status=AgreementStatus.MODEL_AGREEMENT,
            summary="Both face-manipulation models (EFFORT & GenD) found no significant manipulation artifacts.",
            details=(
                f"EFFORT score ({effort.manipulation_score:.3f}) and "
                f"GenD score ({gend.fake_score:.3f}) both remained below classification thresholds. "
                "No localized face-swapping or facial boundary boundary artifacts detected."
            ),
            models_participating=models_participating,
            models_flagged=[],
            confidence_assessment="HIGH_CONCORDANCE_CLEAN",
        )

    # Disagreement
    flagged_model = "EFFORT" if effort_flagged else "GenD"
    clean_model = "GenD" if effort_flagged else "EFFORT"
    flagged_score = effort.manipulation_score if effort_flagged else gend.fake_score
    clean_score = gend.fake_score if effort_flagged else effort.manipulation_score

    return CategoryAgreement(
        category=ModelCategory.FACE_MANIPULATION,
        status=AgreementStatus.MODEL_DISAGREEMENT,
        summary=f"Detectors disagree: {flagged_model} flagged possible manipulation, while {clean_model} did not.",
        details=(
            f"{flagged_model} scored {flagged_score:.3f} (above 0.50 threshold), "
            f"while {clean_model} scored {clean_score:.3f} (below threshold). "
            "Disagreement may stem from subtle compression artifacts, lighting inconsistencies, or distinct training distributions. "
            "Manual examiner inspection or forensic residual review recommended."
        ),
        models_participating=models_participating,
        models_flagged=models_flagged,
        confidence_assessment="DISAGREEMENT_INCONCLUSIVE",
    )


def evaluate_ai_generation_agreement(
    smaug: Optional[SmaugDetectionDetails],
    fsd: Optional[FSDDetectionDetails],
) -> CategoryAgreement:
    """
    Evaluates agreement between Smaug and FSD for full-image AI generation.
    """
    models_participating: List[str] = []
    models_flagged: List[str] = []

    smaug_valid = smaug is not None and smaug.status == ModelInferenceStatus.SUCCESS
    fsd_valid = fsd is not None and fsd.status == ModelInferenceStatus.SUCCESS

    smaug_flagged = False
    if smaug_valid and smaug is not None and smaug.ai_generation_score is not None:
        models_participating.append("Smaug-AI-Image-Detector")
        if smaug.ai_generation_score >= 0.50:
            smaug_flagged = True
            models_flagged.append("Smaug-AI-Image-Detector")

    fsd_flagged = False
    if fsd_valid and fsd is not None and fsd.native_z_score is not None:
        models_participating.append("Forensic-Self-Descriptions (FSD)")
        # More negative than threshold (-2.0) flags synthetic content
        if fsd.is_fake or (fsd.native_z_score < fsd.threshold_used):
            fsd_flagged = True
            models_flagged.append("Forensic-Self-Descriptions (FSD)")

    if len(models_participating) == 0:
        return CategoryAgreement(
            category=ModelCategory.AI_GENERATED_IMAGE,
            status=AgreementStatus.INSUFFICIENT_EVIDENCE,
            summary="AI-generation detectors could not be executed.",
            details="Neither Smaug nor FSD produced a valid score (weights may be missing or FSD skipped due to licensing).",
            models_participating=[],
            models_flagged=[],
            confidence_assessment="INSUFFICIENT_EVIDENCE",
        )

    if len(models_participating) == 1:
        single_name = models_participating[0]
        is_single_flagged = len(models_flagged) == 1
        status = AgreementStatus.POSSIBLE_MANIPULATION if is_single_flagged else AgreementStatus.INCONCLUSIVE
        summary = (
            f"Only {single_name} evaluated full-scene generation. "
            f"Result: {'synthetic generation signals flagged' if is_single_flagged else 'natural photographic distribution indicated'}."
        )
        details = (
            "Cross-validation with a secondary AI-generation detector was omitted or unavailable. "
            "Interpret single-model findings alongside deterministic forensic diagnostics."
        )
        return CategoryAgreement(
            category=ModelCategory.AI_GENERATED_IMAGE,
            status=status,
            summary=summary,
            details=details,
            models_participating=models_participating,
            models_flagged=models_flagged,
            confidence_assessment="MODERATE_SINGLE_MODEL",
        )

    # Both models evaluated: check agreement
    if smaug_flagged and fsd_flagged:
        return CategoryAgreement(
            category=ModelCategory.AI_GENERATED_IMAGE,
            status=AgreementStatus.MODEL_AGREEMENT,
            summary="Both AI-generation detectors (Smaug & FSD) indicate synthetic generation artifacts.",
            details=(
                f"Smaug vision model indicated synthetic score {smaug.ai_generation_score:.3f} and "
                f"FSD forensic residuals indicated negative z-score {fsd.native_z_score:.3f} (below threshold {fsd.threshold_used}). "
                "Concordance between high-level semantic vision features and low-level sensor noise residuals "
                "strongly supports the AI-generation hypothesis."
            ),
            models_participating=models_participating,
            models_flagged=models_flagged,
            confidence_assessment="HIGH_CONCORDANCE",
        )

    if (not smaug_flagged) and (not fsd_flagged):
        return CategoryAgreement(
            category=ModelCategory.AI_GENERATED_IMAGE,
            status=AgreementStatus.MODEL_AGREEMENT,
            summary="Both AI-generation detectors (Smaug & FSD) indicate natural photographic characteristics.",
            details=(
                f"Smaug score ({smaug.ai_generation_score:.3f}) and "
                f"FSD z-score ({fsd.native_z_score:.3f}, expected >= {fsd.threshold_used}) "
                "are both consistent with authentic camera captures rather than generative synthesis."
            ),
            models_participating=models_participating,
            models_flagged=[],
            confidence_assessment="HIGH_CONCORDANCE_NATURAL",
        )

    # Disagreement
    if smaug_flagged and not fsd_flagged:
        return CategoryAgreement(
            category=ModelCategory.AI_GENERATED_IMAGE,
            status=AgreementStatus.MODEL_DISAGREEMENT,
            summary="Detectors disagree: Smaug flagged synthetic patterns while FSD indicated natural camera residuals.",
            details=(
                f"Smaug vision tokens scored {smaug.ai_generation_score:.3f} (synthetic), whereas "
                f"FSD native noise residual z-score was {fsd.native_z_score:.3f} (natural). "
                "This pattern can occur when a genuine camera photo is processed with heavy beauty filters, "
                "compression, or when an AI-generated image has had realistic sensor grain applied."
            ),
            models_participating=models_participating,
            models_flagged=["Smaug-AI-Image-Detector"],
            confidence_assessment="DISAGREEMENT_INCONCLUSIVE",
        )
    else:
        return CategoryAgreement(
            category=ModelCategory.AI_GENERATED_IMAGE,
            status=AgreementStatus.MODEL_DISAGREEMENT,
            summary="Detectors disagree: FSD flagged abnormal forensic residuals while Smaug indicated natural imagery.",
            details=(
                f"FSD detected abnormal sensor residuals (z-score: {fsd.native_z_score:.3f}), while "
                f"Smaug vision score ({smaug.ai_generation_score:.3f}) remained low. "
                "This pattern often indicates localized editing, recompression, or blending rather than full-image diffusion."
            ),
            models_participating=models_participating,
            models_flagged=["Forensic-Self-Descriptions (FSD)"],
            confidence_assessment="DISAGREEMENT_INCONCLUSIVE",
        )
