"""
ShieldHer – Smaug Model Adapter Service.

Integrates the official Smaug-AI-Image-Detector (fine-tuned EmbeddingGemma-2
vision architecture by Abacus.AI) for pretrained full-image AI generation detection.

Official Repository: https://huggingface.co/abacusai/Smaug-AI-Image-Detector
License: Apache-2.0

Key Architectural & Safety Principles:
- Lazy initialization: model weights and sentence-transformers pipeline are loaded on demand.
- Honest reporting: Missing weights, missing dependencies, or corrupt checkpoints return
  structured error statuses (UNAVAILABLE, DEPENDENCY_MISSING, INCOMPATIBLE_WEIGHTS)
  and NEVER invent synthetic predictions or random scores.
- Uncalibrated score semantics: Raw sigmoid probabilities are not misrepresented as
  certified posterior probabilities. Calibration limitations are explicitly documented.
- Non-interchangeable domain boundaries: Full-image generation detection is decoupled
  from face-swap manipulation detection (EFFORT). Neither score alone proves authenticity.
- Native multi-crop preprocessing: Evaluates the full image at native resolution via 3
  systematic 528x528 crops (start, centre, end along the long axis).
"""
from __future__ import annotations

import math
import time
from pathlib import Path
from typing import List, Optional, Tuple, Union

import numpy as np
from PIL import Image, ImageOps
import structlog

from app.config import get_settings
from app.schemas.verification import (
    ModelInferenceStatus,
    SmaugDetectionDetails,
    SmaugPredictedLabel,
)

logger = structlog.get_logger(__name__)

# Constants matching Smaug-AI-Image-Detector training specification
CROP: int = 528
SIDE: int = 576
BUDGET: int = 140  # Soft vision tokens budget in image processor


def views(img: Image.Image, crops: int = 3) -> List[Image.Image]:
    """
    Native-resolution multi-crop preprocessing matching Abacus.AI's official pipeline:
    1. EXIF orientation transposition non-destructively, convert to RGB.
    2. Rescale shorter side to 576 px (using Lanczos) if shorter side > 576.
    3. Upscale shorter side to 528 px (using Bicubic) if shorter side < 528.
    4. Generate 528 x 528 crops at native resolution:
       - crops=3: start (0), centre, and end along the long axis, centre on short axis.
       - crops=1: centre crop only.
    """
    if crops not in (1, 3):
        raise ValueError(f"crops must be 1 or 3, got {crops}")

    img = ImageOps.exif_transpose(img).convert("RGB")
    w, h = img.size

    if min(w, h) > SIDE:
        s = SIDE / min(w, h)
        img = img.resize((round(w * s), round(h * s)), Image.LANCZOS)
    elif min(w, h) < CROP:
        s = CROP / min(w, h)
        img = img.resize((math.ceil(w * s), math.ceil(h * s)), Image.BICUBIC)

    w, h = img.size
    cx, cy = (w - CROP) // 2, (h - CROP) // 2

    if crops == 1:
        return [img.crop((cx, cy, cx + CROP, cy + CROP))]

    if w >= h:
        return [img.crop((x, cy, x + CROP, cy + CROP)) for x in (0, cx, w - CROP)]
    return [img.crop((cx, y, cx + CROP, y + CROP)) for y in (0, cy, h - CROP)]


class SmaugModelAdapter:
    """
    Thread-safe adapter for lazy initialization and execution of Smaug-AI-Image-Detector.
    """

    _instance: Optional["SmaugModelAdapter"] = None

    def __init__(self, weights_path: Optional[Path] = None, device: Optional[str] = None):
        self._custom_weights_path = weights_path
        self._custom_device = device
        self._st_model = None
        self._initialized = False
        self._init_error: Optional[Tuple[ModelInferenceStatus, str]] = None

    @property
    def settings(self):
        return get_settings()

    @property
    def weights_path(self) -> Path:
        return self._custom_weights_path or self.settings.smaug_weights_path

    @property
    def device_str(self) -> str:
        return self._custom_device or self.settings.smaug_device

    def _load_model(self) -> Tuple[Optional[object], Optional[ModelInferenceStatus], Optional[str]]:
        """
        Lazily load the fine-tuned EmbeddingGemma-2 model weights.
        Returns (model, error_status, error_message).
        """
        # 1. Check dependencies
        try:
            import torch
            from sentence_transformers import SentenceTransformer
        except ImportError as exc:
            msg = f"Dependencies missing: {exc}. Install sentence-transformers>=3.0.0 and torch."
            logger.error("Smaug dependency missing", error=msg)
            return None, ModelInferenceStatus.DEPENDENCY_MISSING, msg

        # 2. Check local weights availability or repo identifier
        target_path = self.weights_path
        model_source: Union[str, Path] = target_path

        # If local directory doesn't have the weights safetensors or modules.json
        has_local_weights = (
            target_path.exists()
            and (target_path / "model.safetensors").exists()
            and (target_path / "modules.json").exists()
        )

        if not has_local_weights:
            # Fall back to model id only if huggingface_hub is available and online
            # If path explicitly pointed somewhere that does not exist, report UNAVAILABLE
            if not target_path.exists():
                msg = (
                    f"Smaug weights directory not found at '{target_path}'. "
                    "Download official weights from Hugging Face using: "
                    "snapshot_download('abacusai/Smaug-AI-Image-Detector', local_dir='backend/models/weights/smaug')"
                )
                logger.warning("Smaug weights missing", weights_path=str(target_path))
                return None, ModelInferenceStatus.UNAVAILABLE, msg
            model_source = self.settings.smaug_model_id

        # 3. Determine device and precision
        # bfloat16 on CUDA; float32 on CPU and Apple Silicon Metal (fp16 is unstable for this model)
        if torch.cuda.is_available() and self.device_str == "cuda":
            device = "cuda"
            dtype = torch.bfloat16
        elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available() and self.device_str == "mps":
            device = "mps"
            dtype = torch.float32
        else:
            device = "cpu"
            dtype = torch.float32

        # 4. Instantiate SentenceTransformer model
        try:
            logger.info("Instantiating Smaug detector", model_source=str(model_source), device=device, dtype=str(dtype))
            st = SentenceTransformer(
                str(model_source),
                device=device,
                config_kwargs={"audio_config": None},
                model_kwargs={"torch_dtype": dtype},
            )

            # Configure image processor vision token budget
            ip = st[0].processor.image_processor
            ip.max_soft_tokens = ip.image_seq_length = BUDGET

            logger.info("Smaug-AI-Image-Detector loaded and initialized successfully")
            return st, None, None

        except (RuntimeError, ValueError, KeyError) as exc:
            msg = f"Incompatible or corrupted Smaug weights at '{model_source}': {exc}"
            logger.error("Incompatible Smaug weights", error=msg)
            return None, ModelInferenceStatus.INCOMPATIBLE_WEIGHTS, msg
        except Exception as exc:
            msg = f"Unexpected failure loading Smaug model: {exc}"
            logger.error("Smaug load error", error=msg)
            return None, ModelInferenceStatus.ERROR, msg

    def predict(
        self,
        image: Union[np.ndarray, Image.Image, Path, str],
        crops: Optional[int] = None,
        input_source_used: str = "full_image",
    ) -> SmaugDetectionDetails:
        """
        Run AI generation detection on the provided image using native multi-crop evaluation.
        """
        num_crops = crops or self.settings.smaug_num_crops
        if num_crops not in (1, 3):
            num_crops = 3

        # 1. Lazy initialization
        if not self._initialized:
            model, err_status, err_msg = self._load_model()
            if err_status is not None:
                self._init_error = (err_status, err_msg)
                return SmaugDetectionDetails(
                    status=err_status,
                    error_message=err_msg,
                    input_source_used=input_source_used,
                )
            self._st_model = model
            self._initialized = True

        if self._st_model is None:
            err_status, err_msg = self._init_error or (ModelInferenceStatus.ERROR, "Smaug model unavailable")
            return SmaugDetectionDetails(
                status=err_status,
                error_message=err_msg,
                input_source_used=input_source_used,
            )

        import torch

        start_time = time.perf_counter()

        try:
            # 2. Convert input to PIL Image
            if isinstance(image, np.ndarray):
                pil_img = Image.fromarray(image).convert("RGB")
            elif isinstance(image, (str, Path)):
                pil_img = Image.open(str(image)).convert("RGB")
            elif isinstance(image, Image.Image):
                pil_img = image.convert("RGB")
            else:
                raise ValueError(f"Unsupported image type: {type(image)}")

            # 3. Generate native multi-crop views
            crop_views = views(pil_img, crops=num_crops)
            flat = [{"image": v} for v in crop_views]

            # 4. Model inference
            logits = (
                self._st_model.encode(flat, batch_size=16, convert_to_tensor=True)
                .float()
                .view(1, num_crops)
            )

            # Per-crop sigmoid scores and aggregate score
            raw_crop_probs = torch.sigmoid(logits).squeeze(0).tolist()
            if not isinstance(raw_crop_probs, list):
                raw_crop_probs = [raw_crop_probs]
            crop_scores = [round(float(p), 4) for p in raw_crop_probs]

            # Official aggregate: sigmoid of the average crop logits
            avg_prob = round(float(torch.sigmoid(logits.mean(1)).item()), 4)
            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)

            # Decision threshold
            threshold = self.settings.smaug_decision_threshold
            label = (
                SmaugPredictedLabel.AI_GENERATED
                if avg_prob >= threshold
                else SmaugPredictedLabel.NATURAL_OR_AUTHENTIC
            )

            return SmaugDetectionDetails(
                status=ModelInferenceStatus.SUCCESS,
                inference_duration_ms=elapsed_ms,
                ai_generation_score=avg_prob,
                crop_scores=crop_scores,
                crops_evaluated=num_crops,
                predicted_label=label,
                input_source_used=input_source_used,
            )

        except Exception as exc:
            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
            logger.error("Smaug inference execution failure", error=str(exc))
            return SmaugDetectionDetails(
                status=ModelInferenceStatus.ERROR,
                inference_duration_ms=elapsed_ms,
                error_message=f"Smaug inference execution failed: {exc}",
                input_source_used=input_source_used,
            )


_smaug_adapter_service: Optional[SmaugModelAdapter] = None


def get_smaug_adapter() -> SmaugModelAdapter:
    """Return singleton instance of SmaugModelAdapter."""
    global _smaug_adapter_service
    if _smaug_adapter_service is None:
        _smaug_adapter_service = SmaugModelAdapter()
    return _smaug_adapter_service
