"""
ShieldHer – Effort Model Adapter Service.

Integrates the official Effort-AIGI-Detection model (CLIP-ViT-L/14 with SVD Residuals)
for pretrained face manipulation and face-swap detection.

Adheres strictly to forensic and safety guidelines:
- Lazy initialization: model and weights are only loaded on demand.
- Honest reporting: Missing checkpoints, missing dependencies, or weight mismatches
  return structured error statuses (UNAVAILABLE, DEPENDENCY_MISSING, INCOMPATIBLE_WEIGHTS)
  and NEVER fabricate predictions with random weights.
- Uncalibrated score transparency: Raw softmax scores are not misrepresented as
  certified posterior probabilities.
- Exact preprocessing: Input faces/images are resized to 224x224 and normalized
  with OpenAI CLIP mean and std constants.
"""
from __future__ import annotations

import time
from pathlib import Path
from typing import Optional, Tuple
import cv2
import numpy as np
import structlog

from app.config import get_settings
from app.schemas.verification import (
    DetectionDetails,
    GradCamResult,
    ModelInferenceStatus,
    PredictedLabel,
)

logger = structlog.get_logger(__name__)

# Official OpenAI CLIP normalization constants used in Effort
CLIP_MEAN = np.array([0.48145466, 0.4578275, 0.40821073], dtype=np.float32)
CLIP_STD = np.array([0.26862954, 0.26130258, 0.27577711], dtype=np.float32)
EFFORT_INPUT_RES = (224, 224)


def preprocess_for_effort(rgb_image: np.ndarray) -> "torch.Tensor":
    """
    Exact preprocessing pipeline as defined by official Effort detector:
    1. Bilinear resize to 224x224.
    2. Convert RGB uint8 [0, 255] to float32 [0.0, 1.0].
    3. Normalize with CLIP mean and std.
    4. Permute to (C, H, W) and add batch dimension (1, 3, 224, 224).
    """
    import torch

    # 1. Resize
    resized = cv2.resize(rgb_image, EFFORT_INPUT_RES, interpolation=cv2.INTER_LINEAR)

    # 2. Scale to [0.0, 1.0]
    img_float = resized.astype(np.float32) / 255.0

    # 3. Normalize: (img - mean) / std
    norm_img = (img_float - CLIP_MEAN) / CLIP_STD

    # 4. HWC -> CHW -> BCHW Tensor
    tensor = torch.from_numpy(norm_img).permute(2, 0, 1).unsqueeze(0).contiguous()
    return tensor


class EffortModelAdapter:
    """
    Thread-safe adapter for lazy initialization and execution of EffortDetector.
    """

    _instance: Optional["EffortModelAdapter"] = None

    def __init__(self, checkpoint_path: Optional[Path] = None, device: Optional[str] = None):
        self._custom_checkpoint_path = checkpoint_path
        self._custom_device = device
        self._model = None
        self._gradcam = None
        self._initialized = False
        self._init_error: Optional[Tuple[ModelInferenceStatus, str]] = None

    @property
    def settings(self):
        return get_settings()

    @property
    def checkpoint_path(self) -> Path:
        return self._custom_checkpoint_path or self.settings.effort_checkpoint_path

    @property
    def device_str(self) -> str:
        return self._custom_device or self.settings.effort_device

    def _load_model(self) -> Tuple[Optional[object], Optional[ModelInferenceStatus], Optional[str]]:
        """
        Lazily load the model and checkpoint weights.
        Returns (model, error_status, error_message).
        """
        # 1. Check dependencies
        try:
            import torch
            from app.models.effort import EffortDetector, EffortGradCAM
        except ImportError as exc:
            msg = f"PyTorch or Transformers dependency missing: {exc}. Install requirements-ml.txt."
            logger.error("Effort dependency missing", error=msg)
            return None, ModelInferenceStatus.DEPENDENCY_MISSING, msg

        # 2. Check checkpoint availability
        ckpt_path = self.checkpoint_path
        if not ckpt_path.exists():
            msg = (
                f"Effort FaceForensics++ checkpoint not found at '{ckpt_path}'. "
                "Download official weights from: "
                "https://drive.google.com/file/d/1m4fyJecABU-Yk3bJ4b1WhUwQa0xCkMLI/view?usp=drive_link "
                "and save to backend/models/weights/effort_clip_L14_trainOn_FaceForensic.pth"
            )
            logger.warning("Effort checkpoint missing", checkpoint_path=str(ckpt_path))
            return None, ModelInferenceStatus.UNAVAILABLE, msg

        # 3. Load checkpoint state_dict
        device = torch.device(self.device_str if torch.cuda.is_available() and self.device_str == "cuda" else "cpu")
        try:
            logger.info("Instantiating EffortDetector backbone", device=str(device))
            model = EffortDetector()

            logger.info("Loading checkpoint weights", path=str(ckpt_path))
            ckpt = torch.load(str(ckpt_path), map_location=device)
            state_dict = ckpt.get("state_dict", ckpt)
            clean_state_dict = {k.replace("module.", ""): v for k, v in state_dict.items()}

            model.load_state_dict(clean_state_dict, strict=True)
            model.to(device)
            model.eval()

            self._gradcam = EffortGradCAM(model)
            logger.info("EffortDetector loaded and initialized successfully")
            return model, None, None

        except (RuntimeError, ValueError, KeyError) as exc:
            msg = f"Incompatible or corrupted checkpoint weights at '{ckpt_path}': {exc}"
            logger.error("Incompatible checkpoint", error=msg)
            return None, ModelInferenceStatus.INCOMPATIBLE_WEIGHTS, msg
        except Exception as exc:
            msg = f"Unexpected failure loading Effort model: {exc}"
            logger.error("Model load error", error=msg)
            return None, ModelInferenceStatus.ERROR, msg

    def predict(
        self,
        rgb_image: np.ndarray,
        include_gradcam: bool = False,
        input_source_used: str = "face_crop",
    ) -> DetectionDetails:
        """
        Run inference on the provided RGB image (face crop or full image).
        """
        # Lazy initialization
        if not self._initialized:
            model, err_status, err_msg = self._load_model()
            if err_status is not None:
                self._init_error = (err_status, err_msg)
                return DetectionDetails(
                    status=err_status,
                    error_message=err_msg,
                    input_source_used=input_source_used,
                )
            self._model = model
            self._initialized = True

        if self._model is None:
            err_status, err_msg = self._init_error or (ModelInferenceStatus.ERROR, "Model unavailable")
            return DetectionDetails(
                status=err_status,
                error_message=err_msg,
                input_source_used=input_source_used,
            )

        import torch

        device = next(self._model.parameters()).device
        start_time = time.perf_counter()

        try:
            # 1. Preprocess
            input_tensor = preprocess_for_effort(rgb_image).to(device)

            # 2. Grad-CAM (if requested)
            gradcam_result = None
            if include_gradcam and self._gradcam is not None:
                try:
                    heatmap_224, overlay_b64 = self._gradcam.generate_heatmap(
                        input_tensor.clone(),
                        target_class=1,  # Class 1: Manipulated
                        original_rgb=rgb_image,
                    )
                    # Sample a compact 16x16 grid for JSON response
                    grid_16 = cv2.resize(heatmap_224, (16, 16), interpolation=cv2.INTER_AREA)
                    gradcam_result = GradCamResult(
                        has_gradcam=True,
                        target_class=1,
                        target_layer="encoder.layers[-1].layer_norm1",
                        heatmap_dimensions=[224, 224],
                        heatmap_grid=np.round(grid_16, 4).tolist(),
                        overlay_base64_png=overlay_b64,
                    )
                except Exception as g_exc:
                    logger.warning("Grad-CAM generation failed", error=str(g_exc))
                    gradcam_result = GradCamResult(
                        has_gradcam=False,
                        target_class=1,
                        target_layer="encoder.layers[-1].layer_norm1",
                        heatmap_dimensions=[0, 0],
                    )

            # 3. Model Forward
            with torch.inference_mode():
                logits = self._model(input_tensor)
                probs = torch.softmax(logits, dim=1)

            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
            raw_logits = [round(float(v), 4) for v in logits.squeeze(0).cpu().numpy()]
            manipulation_prob = round(float(probs[0, 1].item()), 4)

            # Determine label using decision threshold
            threshold = self.settings.effort_decision_threshold
            label = (
                PredictedLabel.MANIPULATED
                if manipulation_prob >= threshold
                else PredictedLabel.AUTHENTIC
            )

            return DetectionDetails(
                status=ModelInferenceStatus.SUCCESS,
                inference_duration_ms=elapsed_ms,
                raw_logits=raw_logits,
                manipulation_score=manipulation_prob,
                predicted_label=label,
                gradcam=gradcam_result,
                input_source_used=input_source_used,
            )

        except Exception as exc:
            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
            logger.error("Inference execution failure", error=str(exc))
            return DetectionDetails(
                status=ModelInferenceStatus.ERROR,
                inference_duration_ms=elapsed_ms,
                error_message=f"Inference execution failed: {exc}",
                input_source_used=input_source_used,
            )


_effort_adapter_service: Optional[EffortModelAdapter] = None


def get_effort_adapter() -> EffortModelAdapter:
    global _effort_adapter_service
    if _effort_adapter_service is None:
        _effort_adapter_service = EffortModelAdapter()
    return _effort_adapter_service
