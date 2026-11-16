"""
ShieldHer – Forensic Self-Descriptions (FSD) Model Adapter Service.

Integrates the official FSD detector (CVPR 2025 Oral) for zero-shot forensic
residual detection of AI-generated and synthetically synthesized images.

Official Repository: https://github.com/ductai199x/Forensic-Self-Descriptions-CVPR25
Paper: "Forensic Self-Descriptions Are All You Need for Zero-Shot Detection,
        Open-Set Source Attribution, and Clustering of AI-generated Images" (CVPR 2025)
License: CC BY-NC-SA 4.0 (Non-Commercial Research Use Only)

Key Forensic & Licensing Principles:
- Licensing Guard: Preserved behind explicit configuration `enable_fsd`.
  If disabled, returns structured SKIPPED status documenting non-commercial limitation.
- Lazy Initialization: Detector weights and transforms are loaded on demand.
- Native Score Preservation: Preserves native z-score without fabricating artificial
  probabilities. More negative z-scores indicate stronger synthetic deviation.
- Threshold Semantics: Uses documented threshold (default -2.0) for `is_fake` determination.
- Honest Reporting: Returns UNAVAILABLE if checkpoints are missing, never fake outputs.
"""
from __future__ import annotations

import tempfile
import time
from pathlib import Path
from typing import Optional, Tuple, Union

import numpy as np
from PIL import Image
import structlog

from app.config import get_settings
from app.schemas.verification import (
    FSDDetectionDetails,
    ModelInferenceStatus,
)

logger = structlog.get_logger(__name__)


class FSDModelAdapter:
    """
    Thread-safe adapter for lazy initialization and execution of FSDDetector.
    """

    _instance: Optional["FSDModelAdapter"] = None

    def __init__(
        self,
        weights_dir: Optional[Path] = None,
        device: Optional[str] = None,
    ):
        self._custom_weights_dir = weights_dir
        self._custom_device = device
        self._detector = None
        self._initialized = False
        self._init_error: Optional[Tuple[ModelInferenceStatus, str]] = None

    @property
    def settings(self):
        return get_settings()

    @property
    def weights_dir(self) -> Path:
        return self._custom_weights_dir or self.settings.fsd_weights_path

    @property
    def device_str(self) -> str:
        return self._custom_device or self.settings.fsd_device

    def _load_detector(self) -> Tuple[Optional[object], Optional[ModelInferenceStatus], Optional[str]]:
        """
        Lazily load FSDDetector and pretrained weights.
        Returns (detector, error_status, error_message).
        """
        # 1. Check licensing toggle
        if not self.settings.enable_fsd:
            msg = (
                "FSD model is disabled via configuration (settings.enable_fsd=False) "
                "in compliance with its CC BY-NC-SA 4.0 non-commercial research license."
            )
            logger.info("FSD disabled by licensing policy", reason=msg)
            return None, ModelInferenceStatus.SKIPPED, msg

        # 2. Check dependencies
        try:
            import torch
            from fsd import FSDDetector
        except ImportError as exc:
            msg = f"FSD dependencies missing: {exc}. Ensure fsd-detector is installed."
            logger.error("FSD dependency missing", error=msg)
            return None, ModelInferenceStatus.DEPENDENCY_MISSING, msg

        # 3. Check local weights
        w_dir = self.weights_dir
        req_files = ["config.json", "fre.pt", "gmm.pt", "fsd_transforms.pt"]
        if not (w_dir.exists() and all((w_dir / f).exists() for f in req_files)):
            msg = (
                f"FSD pretrained weights not found at '{w_dir}'. "
                "Download official v1.2.0 release weights from: "
                "https://github.com/ductai199x/Forensic-Self-Descriptions-CVPR25/releases/tag/v1.2.0"
            )
            logger.warning("FSD weights missing", weights_dir=str(w_dir))
            return None, ModelInferenceStatus.UNAVAILABLE, msg

        # 4. Determine device
        device = (
            "cuda"
            if torch.cuda.is_available() and self.device_str == "cuda"
            else "cpu"
        )

        try:
            logger.info("Instantiating FSDDetector", weights_dir=str(w_dir), device=device)
            detector = FSDDetector.load(
                weights_dir=str(w_dir),
                device=device,
                threshold=self.settings.fsd_decision_threshold,
            )
            # Cap max_size on CPU to prevent excessive memory usage during multi-scale patch unfolding
            if device == "cpu" and "fsd" in detector.config:
                detector.config["fsd"]["max_size"] = min(detector.config["fsd"].get("max_size", 1024), 512)
            logger.info("FSDDetector loaded and initialized successfully")
            return detector, None, None

        except (RuntimeError, ValueError, KeyError) as exc:
            msg = f"Incompatible or corrupted FSD weights at '{w_dir}': {exc}"
            logger.error("Incompatible FSD weights", error=msg)
            return None, ModelInferenceStatus.INCOMPATIBLE_WEIGHTS, msg
        except Exception as exc:
            msg = f"Unexpected failure loading FSD model: {exc}"
            logger.error("FSD load error", error=msg)
            return None, ModelInferenceStatus.ERROR, msg

    def predict(
        self,
        image: Union[np.ndarray, Image.Image, Path, str],
    ) -> FSDDetectionDetails:
        """
        Run zero-shot forensic residual scoring on the original validated image.
        """
        # 1. License check first
        if not self.settings.enable_fsd:
            return FSDDetectionDetails(
                status=ModelInferenceStatus.SKIPPED,
                error_message=(
                    "FSD detector disabled per configuration. "
                    "Non-commercial research license (CC BY-NC-SA 4.0) applies."
                ),
                threshold_used=self.settings.fsd_decision_threshold,
                device_used=self.device_str,
            )

        # 2. Lazy initialization
        if not self._initialized:
            detector, err_status, err_msg = self._load_detector()
            if err_status is not None:
                self._init_error = (err_status, err_msg)
                return FSDDetectionDetails(
                    status=err_status,
                    error_message=err_msg,
                    threshold_used=self.settings.fsd_decision_threshold,
                    device_used=self.device_str,
                )
            self._detector = detector
            self._initialized = True

        if self._detector is None:
            err_status, err_msg = self._init_error or (ModelInferenceStatus.ERROR, "FSD detector unavailable")
            return FSDDetectionDetails(
                status=err_status,
                error_message=err_msg,
                threshold_used=self.settings.fsd_decision_threshold,
                device_used=self.device_str,
            )

        start_time = time.perf_counter()
        tmp_file: Optional[Path] = None

        try:
            # 3. Determine file path for FSDDetector.score()
            if isinstance(image, (str, Path)) and Path(image).exists():
                img_path = str(image)
            else:
                # Convert np.ndarray or PIL Image to temporary RGB file for FRE
                if isinstance(image, np.ndarray):
                    pil_img = Image.fromarray(image).convert("RGB")
                elif isinstance(image, Image.Image):
                    pil_img = image.convert("RGB")
                else:
                    raise ValueError(f"Unsupported image type: {type(image)}")

                with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tf:
                    tmp_file = Path(tf.name)
                    pil_img.save(tmp_file, format="PNG")
                    img_path = str(tmp_file)

            # 4. Score image with official FSD detector
            result = self._detector.score(img_path)
            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)

            native_z = round(float(result.z_score), 4)
            raw_sc = round(float(result.raw_score), 4)
            is_fake = bool(result.is_fake)
            decision = "AI_GENERATED" if is_fake else "AUTHENTIC"

            return FSDDetectionDetails(
                status=ModelInferenceStatus.SUCCESS,
                native_z_score=native_z,
                raw_score=raw_sc,
                is_fake=is_fake,
                threshold_used=float(result.threshold),
                model_derived_decision=decision,
                inference_duration_ms=elapsed_ms,
                device_used=self.device_str,
            )

        except Exception as exc:
            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
            logger.error("FSD inference execution failure", error=str(exc))
            return FSDDetectionDetails(
                status=ModelInferenceStatus.ERROR,
                inference_duration_ms=elapsed_ms,
                error_message=f"FSD inference execution failed: {exc}",
                threshold_used=self.settings.fsd_decision_threshold,
                device_used=self.device_str,
            )
        finally:
            if tmp_file and tmp_file.exists():
                try:
                    tmp_file.unlink()
                except OSError:
                    pass


_fsd_adapter_service: Optional[FSDModelAdapter] = None


def get_fsd_adapter() -> FSDModelAdapter:
    """Return singleton instance of FSDModelAdapter."""
    global _fsd_adapter_service
    if _fsd_adapter_service is None:
        _fsd_adapter_service = FSDModelAdapter()
    return _fsd_adapter_service
