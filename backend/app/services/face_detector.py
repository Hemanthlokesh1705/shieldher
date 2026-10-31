"""
ShieldHer – Pretrained MediaPipe Face Detector Service.

Detects human faces and extracts:
- Face count
- Bounding boxes (both pixel coordinates and normalized)
- Detector confidence score
- Available facial keypoints (right eye, left eye, nose tip, mouth center, tragions)

IMPORTANT ETHICAL & DOMAIN CONSIDERATIONS:
- A detected face is NOT proof of a real human or an authentic photograph.
- AI-generated human faces must be allowed to proceed when suitable.
- When no face is detected, we report NO_FACE_DETECTED; we do NOT claim that
  the image necessarily contains an animal or an object.
- Deepfake classification is strictly outside the scope of this module.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import List, Optional
import numpy as np
import structlog

from app.config import get_settings
from app.schemas.upload import BoundingBox, DetectedFace, KeypointInfo

logger = structlog.get_logger(__name__)

# Standard BlazeFace 6-keypoint landmark indices
KEYPOINT_NAMES = [
    "right_eye",
    "left_eye",
    "nose_tip",
    "mouth_center",
    "right_ear_tragion",
    "left_ear_tragion",
]

MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/face_detector/"
    "blaze_face_short_range/float16/1/blaze_face_short_range.tflite"
)


class FaceDetectorService:
    """Wrapper around MediaPipe Vision FaceDetector."""

    _instance: Optional["FaceDetectorService"] = None

    def __init__(self, model_path: Optional[Path] = None):
        self.settings = get_settings()
        self.model_path = model_path or self._resolve_model_path()
        self._detector = None

    def _resolve_model_path(self) -> Path:
        cache_dir = self.settings.ml_model_cache_dir
        cache_dir.mkdir(parents=True, exist_ok=True)
        target_path = cache_dir / "blaze_face_short_range.tflite"

        if not target_path.exists():
            logger.info("Face detector model not found locally; downloading", target=str(target_path))
            try:
                import urllib.request
                urllib.request.urlretrieve(MODEL_URL, str(target_path))
                logger.info("Face detector model downloaded successfully", target=str(target_path))
            except Exception as exc:
                logger.error("Failed to download MediaPipe face detector model", error=str(exc))
                raise RuntimeError(
                    f"MediaPipe face detector model missing at {target_path} and download failed: {exc}"
                ) from exc

        return target_path

    def _get_detector(self):
        if self._detector is None:
            try:
                import mediapipe as mp
                from mediapipe.tasks.python.vision import FaceDetector, FaceDetectorOptions
                from mediapipe.tasks.python.core.base_options import BaseOptions

                base_options = BaseOptions(model_asset_path=str(self.model_path))
                options = FaceDetectorOptions(
                    base_options=base_options,
                    min_detection_confidence=self.settings.min_face_confidence,
                )
                self._detector = FaceDetector.create_from_options(options)
                logger.info("MediaPipe FaceDetector initialized", model_path=str(self.model_path))
            except Exception as exc:
                logger.error("Failed to initialize MediaPipe FaceDetector", error=str(exc))
                raise
        return self._detector

    def detect_faces(self, rgb_image: np.ndarray) -> List[DetectedFace]:
        """
        Run MediaPipe face detection on an RGB NumPy image (H, W, 3).
        Returns list of DetectedFace objects.
        """
        height, width = rgb_image.shape[:2]
        if height == 0 or width == 0:
            return []

        import mediapipe as mp

        detector = self._get_detector()
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_image)
        detection_result = detector.detect(mp_image)

        detected_faces: List[DetectedFace] = []
        if not detection_result or not detection_result.detections:
            return detected_faces

        for idx, det in enumerate(detection_result.detections):
            # 1. Bounding Box
            bbox = det.bounding_box
            # Clamp coordinates to image boundaries
            origin_x = max(0, min(bbox.origin_x, width - 1))
            origin_y = max(0, min(bbox.origin_y, height - 1))
            box_w = max(1, min(bbox.width, width - origin_x))
            box_h = max(1, min(bbox.height, height - origin_y))

            norm_box = BoundingBox(
                origin_x=int(origin_x),
                origin_y=int(origin_y),
                width=int(box_w),
                height=int(box_h),
                normalized_xmin=round(origin_x / width, 4),
                normalized_ymin=round(origin_y / height, 4),
                normalized_width=round(box_w / width, 4),
                normalized_height=round(box_h / height, 4),
            )

            # 2. Confidence
            confidence = 0.0
            if det.categories:
                confidence = float(det.categories[0].score)

            # 3. Keypoints
            keypoints: List[KeypointInfo] = []
            if det.keypoints:
                for k_idx, kp in enumerate(det.keypoints):
                    name = kp.label or (KEYPOINT_NAMES[k_idx] if k_idx < len(KEYPOINT_NAMES) else f"keypoint_{k_idx}")
                    keypoints.append(
                        KeypointInfo(
                            name=name,
                            x=round(float(kp.x), 4) if kp.x is not None else 0.0,
                            y=round(float(kp.y), 4) if kp.y is not None else 0.0,
                            score=round(float(kp.score), 4) if kp.score is not None else None,
                        )
                    )

            detected_faces.append(
                DetectedFace(
                    face_index=idx,
                    bounding_box=norm_box,
                    confidence=round(confidence, 4),
                    keypoints=keypoints,
                )
            )

        return detected_faces


_face_detector_service: Optional[FaceDetectorService] = None


def get_face_detector() -> FaceDetectorService:
    global _face_detector_service
    if _face_detector_service is None:
        _face_detector_service = FaceDetectorService()
    return _face_detector_service
