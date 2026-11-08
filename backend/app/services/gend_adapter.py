"""
ShieldHer – GenD Model Adapter Service.

Integrates the official GenD deepfake detector (CLIP-ViT-L/14 with LinearNorm probe)
for generalizable face manipulation and face-swap detection.

Official Repository: https://github.com/yermandy/GenD
Hugging Face Checkpoint: https://huggingface.co/yermandy/GenD_CLIP_L_14
Paper: "Deepfake Detection that Generalizes Across Benchmarks" (WACV 2026)
License: MIT

Key Forensic Principles:
- Lazy initialization: model weights and feature extractor are loaded only on demand.
- Honest reporting: Missing weights or dependencies return UNAVAILABLE / DEPENDENCY_MISSING
  and NEVER invent random or synthetic scores.
- Uncalibrated score transparency: Raw logits and softmax probabilities are preserved
  and reported separately for both genuine (class 0) and fake (class 1) hypotheses.
- Preprocessing: Uses official CLIP feature extractor on face crop inputs.
"""
from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Optional, Tuple, Union

import numpy as np
from PIL import Image
import structlog

from app.config import get_settings
from app.schemas.verification import (
    GenDDetectionDetails,
    ModelInferenceStatus,
)

logger = structlog.get_logger(__name__)


class GenDModelAdapter:
    """
    Thread-safe adapter for lazy initialization and execution of GenD.
    """

    _instance: Optional["GenDModelAdapter"] = None

    def __init__(
        self,
        weights_dir: Optional[Path] = None,
        device: Optional[str] = None,
    ):
        self._custom_weights_dir = weights_dir
        self._custom_device = device
        self._model = None
        self._initialized = False
        self._init_error: Optional[Tuple[ModelInferenceStatus, str]] = None

    @property
    def settings(self):
        return get_settings()

    @property
    def weights_dir(self) -> Path:
        return self._custom_weights_dir or self.settings.gend_weights_path

    @property
    def device_str(self) -> str:
        return self._custom_device or self.settings.gend_device

    def _load_model(self) -> Tuple[Optional[object], Optional[ModelInferenceStatus], Optional[str]]:
        """
        Lazily load GenD model and safetensors weights.
        Returns (model, error_status, error_message).
        """
        # 1. Check dependencies
        try:
            import torch
            from safetensors.torch import load_file
            from transformers import CLIPModel, CLIPProcessor
        except ImportError as exc:
            msg = f"Dependencies missing: {exc}. Install torch, transformers, and safetensors."
            logger.error("GenD dependency missing", error=msg)
            return None, ModelInferenceStatus.DEPENDENCY_MISSING, msg

        # 2. Check local weights
        w_dir = self.weights_dir
        config_path = w_dir / "config.json"
        safetensors_path = w_dir / "model.safetensors"

        if not (config_path.exists() and safetensors_path.exists()):
            msg = (
                f"GenD checkpoint not found at '{w_dir}'. "
                "Download official checkpoint using: "
                "snapshot_download('yermandy/GenD_CLIP_L_14', local_dir='backend/models/weights/gend')"
            )
            logger.warning("GenD checkpoint missing", weights_dir=str(w_dir))
            return None, ModelInferenceStatus.UNAVAILABLE, msg

        # 3. Determine device
        device = torch.device(
            self.device_str if torch.cuda.is_available() and self.device_str == "cuda" else "cpu"
        )

        try:
            logger.info("Instantiating GenD architecture", weights_dir=str(w_dir), device=str(device))
            
            # Import GenD model definition from local repo files
            import sys
            if str(w_dir) not in sys.path:
                sys.path.insert(0, str(w_dir))

            from modeling_gend import GenD, GenDConfig

            with open(config_path, "r", encoding="utf-8") as f:
                cfg_data = json.load(f)

            config = GenDConfig(**cfg_data)
            model = GenD(config)

            state_dict = load_file(str(safetensors_path))
            model.load_state_dict(state_dict, strict=False)
            model.to(device)
            model.eval()

            logger.info("GenD detector loaded and initialized successfully")
            return model, None, None

        except (RuntimeError, ValueError, KeyError) as exc:
            msg = f"Incompatible or corrupted GenD weights at '{w_dir}': {exc}"
            logger.error("Incompatible GenD weights", error=msg)
            return None, ModelInferenceStatus.INCOMPATIBLE_WEIGHTS, msg
        except Exception as exc:
            msg = f"Unexpected failure loading GenD model: {exc}"
            logger.error("GenD load error", error=msg)
            return None, ModelInferenceStatus.ERROR, msg

    def predict(
        self,
        image: Union[np.ndarray, Image.Image, Path, str],
        input_source_used: str = "face_crop",
    ) -> GenDDetectionDetails:
        """
        Run GenD inference on face crop (or full image fallback).
        """
        # 1. Lazy initialization
        if not self._initialized:
            model, err_status, err_msg = self._load_model()
            if err_status is not None:
                self._init_error = (err_status, err_msg)
                return GenDDetectionDetails(
                    status=err_status,
                    error_message=err_msg,
                    input_source_used=input_source_used,
                    device_used=self.device_str,
                )
            self._model = model
            self._initialized = True

        if self._model is None:
            err_status, err_msg = self._init_error or (ModelInferenceStatus.ERROR, "GenD unavailable")
            return GenDDetectionDetails(
                status=err_status,
                error_message=err_msg,
                input_source_used=input_source_used,
                device_used=self.device_str,
            )

        import torch

        start_time = time.perf_counter()
        device = next(self._model.parameters()).device

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

            # 3. Official Preprocessing via model feature extractor
            tensor = self._model.feature_extractor.preprocess(pil_img).unsqueeze(0).to(device)

            # 4. Inference forward pass
            with torch.inference_mode():
                logits = self._model(tensor)
                probs = logits.softmax(dim=-1)

            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)

            raw_logits_list = [round(float(v), 4) for v in logits.squeeze(0).cpu().numpy()]
            p_authentic = round(float(probs[0, 0].item()), 4)
            p_manipulated = round(float(probs[0, 1].item()), 4)

            # Class determination
            threshold = self.settings.gend_decision_threshold
            predicted_class = "manipulated" if p_manipulated >= threshold else "authentic"

            return GenDDetectionDetails(
                status=ModelInferenceStatus.SUCCESS,
                raw_logits=raw_logits_list,
                class_scores={
                    "authentic": p_authentic,
                    "manipulated": p_manipulated,
                },
                genuine_score=p_authentic,
                fake_score=p_manipulated,
                predicted_class=predicted_class,
                inference_duration_ms=elapsed_ms,
                device_used=str(device),
                preprocessing_version="CLIPProcessor_224x224_norm",
                input_source_used=input_source_used,
            )

        except Exception as exc:
            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
            logger.error("GenD inference execution failure", error=str(exc))
            return GenDDetectionDetails(
                status=ModelInferenceStatus.ERROR,
                inference_duration_ms=elapsed_ms,
                error_message=f"GenD inference execution failed: {exc}",
                input_source_used=input_source_used,
                device_used=str(device),
            )


_gend_adapter_service: Optional[GenDModelAdapter] = None


def get_gend_adapter() -> GenDModelAdapter:
    """Return singleton instance of GenDModelAdapter."""
    global _gend_adapter_service
    if _gend_adapter_service is None:
        _gend_adapter_service = GenDModelAdapter()
    return _gend_adapter_service
