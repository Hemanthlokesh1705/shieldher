"""
ShieldHer – Forensic Image Processing & Quality Assessment Service.

Responsible for:
- Magic bytes file signature verification (JPEG, PNG, WEBP)
- Decompression bomb & pixel count protection
- Original file SHA-256 cryptographic hashing & evidentiary preservation
- Safe EXIF orientation correction (missing EXIF does not cause rejection)
- Image quality calculations (Laplacian blur/sharpness, brightness, contrast)
- Pretrained MediaPipe face detection integration
- Face crop extraction and normalized derivative generation
- Structured status evaluation with configurable provisional thresholds
"""
from __future__ import annotations

import hashlib
import io
import uuid
from pathlib import Path
from typing import Optional, Tuple
import cv2
import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError
import structlog

from app.config import get_settings
from app.schemas.upload import (
    AssessmentStatus,
    CropDimensions,
    DetectedFace,
    EvidenceDerivatives,
    FileMetadata,
    ImageDimensions,
    ProvisionalThresholds,
    QualityMetrics,
    ReasonCode,
    UploadResponse,
)
from app.services.face_detector import get_face_detector

logger = structlog.get_logger(__name__)

# Supported magic byte signatures
MAGIC_SIGNATURES = {
    "image/jpeg": (b"\xFF\xD8\xFF", ".jpg"),
    "image/png": (b"\x89PNG\r\n\x1a\n", ".png"),
}


def _detect_file_signature(data: bytes) -> Optional[Tuple[str, str]]:
    """
    Validate magic bytes for supported forensic image formats.
    Returns (mime_type, extension) or None if signature is unsupported.
    """
    if len(data) < 12:
        return None

    # JPEG
    if data.startswith(b"\xFF\xD8\xFF"):
        return ("image/jpeg", ".jpg")

    # PNG
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return ("image/png", ".png")

    # WEBP: starts with 'RIFF' and has 'WEBP' at bytes 8-12
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return ("image/webp", ".webp")

    return None


class ImageProcessorService:
    def __init__(self, settings=None, face_detector=None):
        self._settings = settings
        self._face_detector = face_detector

    @property
    def settings(self):
        return self._settings or get_settings()

    @property
    def face_detector(self):
        return self._face_detector or get_face_detector()

    def get_provisional_thresholds(self) -> ProvisionalThresholds:
        return ProvisionalThresholds(
            is_provisional=self.settings.quality_thresholds_provisional,
            calibration_status="PROVISIONAL_PENDING_FORENSIC_DATASET_CALIBRATION",
            min_image_width=self.settings.min_image_width,
            min_image_height=self.settings.min_image_height,
            max_image_pixels=self.settings.max_image_pixels,
            min_face_width=self.settings.min_face_width,
            min_face_height=self.settings.min_face_height,
            min_sharpness_score=self.settings.min_sharpness_score,
            min_brightness=self.settings.min_brightness,
            max_brightness=self.settings.max_brightness,
            min_contrast=self.settings.min_contrast,
            min_face_confidence=self.settings.min_face_confidence,
        )

    def calculate_quality_metrics(self, rgb_arr: np.ndarray) -> QualityMetrics:
        """
        Compute image quality metrics using OpenCV and NumPy:
        - Sharpness / Blur: Laplacian variance (higher = sharper)
        - Brightness: Mean pixel luminance (0-255 scale)
        - Contrast: Standard deviation of pixel intensities (0-255 scale)
        """
        if rgb_arr.size == 0:
            return QualityMetrics(
                blur_score=0.0,
                brightness=0.0,
                contrast=0.0,
                is_sharp=False,
                is_well_exposed=False,
                has_acceptable_contrast=False,
            )

        gray = cv2.cvtColor(rgb_arr, cv2.COLOR_RGB2GRAY)
        blur_score = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        brightness = float(np.mean(gray))
        contrast = float(np.std(gray))

        is_sharp = blur_score >= self.settings.min_sharpness_score
        is_well_exposed = (
            self.settings.min_brightness <= brightness <= self.settings.max_brightness
        )
        has_acceptable_contrast = contrast >= self.settings.min_contrast

        return QualityMetrics(
            blur_score=round(blur_score, 2),
            brightness=round(brightness, 2),
            contrast=round(contrast, 2),
            is_sharp=is_sharp,
            is_well_exposed=is_well_exposed,
            has_acceptable_contrast=has_acceptable_contrast,
        )

    def process_upload(
        self,
        raw_bytes: bytes,
        filename: Optional[str] = None,
        content_type: Optional[str] = None,
    ) -> UploadResponse:
        evidence_id = str(uuid.uuid4())
        thresholds = self.get_provisional_thresholds()

        # ── 1. Validate File Size ─────────────────────────────────────────
        if not raw_bytes or len(raw_bytes) == 0:
            return UploadResponse(
                status=AssessmentStatus.UNSUPPORTED_INPUT,
                reasons=[ReasonCode.EMPTY_FILE],
                message="Uploaded file is empty (0 bytes).",
                evidence_id=evidence_id,
                thresholds=thresholds,
            )

        if len(raw_bytes) > self.settings.max_upload_bytes:
            return UploadResponse(
                status=AssessmentStatus.UNSUPPORTED_INPUT,
                reasons=[ReasonCode.FILE_TOO_LARGE],
                message=(
                    f"Uploaded file size ({len(raw_bytes)} bytes) exceeds maximum "
                    f"permitted limit ({self.settings.max_upload_bytes} bytes)."
                ),
                evidence_id=evidence_id,
                thresholds=thresholds,
            )

        # ── 2. Validate Magic Bytes / File Signatures ──────────────────────
        sig_info = _detect_file_signature(raw_bytes)
        if sig_info is None:
            return UploadResponse(
                status=AssessmentStatus.UNSUPPORTED_INPUT,
                reasons=[ReasonCode.UNSUPPORTED_MAGIC_BYTES],
                message="File signature is invalid or unrecognized. Supported formats: JPEG, PNG, WEBP.",
                evidence_id=evidence_id,
                thresholds=thresholds,
            )

        detected_mime, file_ext = sig_info

        # ── 3. Cryptographic Hash of Original Byte Stream ─────────────────
        sha256_hash = hashlib.sha256(raw_bytes).hexdigest()

        # ── 4. Evidentiary Preservation: Store Original Untouched ──────────
        originals_dir = self.settings.upload_dir / "originals"
        derivatives_dir = self.settings.upload_dir / "derivatives"
        originals_dir.mkdir(parents=True, exist_ok=True)
        derivatives_dir.mkdir(parents=True, exist_ok=True)

        original_file_path = originals_dir / f"{sha256_hash}{file_ext}"
        if not original_file_path.exists():
            original_file_path.write_bytes(raw_bytes)
            logger.info("Preserved pristine original upload", path=str(original_file_path))

        # ── 5. Decode Image with Pillow (Decompression Bomb Safe) ─────────
        try:
            pil_image = Image.open(io.BytesIO(raw_bytes))
            # Force Pillow to parse image headers and verify consistency
            pil_image.verify()
            # Reopen since verify() invalidates the image pointer
            pil_image = Image.open(io.BytesIO(raw_bytes))
        except Image.DecompressionBombError:
            return UploadResponse(
                status=AssessmentStatus.UNSUPPORTED_INPUT,
                reasons=[ReasonCode.EXCEEDS_PIXEL_LIMIT],
                message="Image pixel dimensions exceed safety limits (potential decompression bomb).",
                evidence_id=evidence_id,
                sha256=sha256_hash,
                thresholds=thresholds,
            )
        except (UnidentifiedImageError, OSError, Exception) as exc:
            logger.warning("Image decoding failed", error=str(exc))
            return UploadResponse(
                status=AssessmentStatus.UNSUPPORTED_INPUT,
                reasons=[ReasonCode.DECODING_FAILED],
                message=f"Failed to decode image data: {exc}",
                evidence_id=evidence_id,
                sha256=sha256_hash,
                thresholds=thresholds,
            )

        # ── 6. EXIF Orientation Transposition (Non-destructive) ───────────
        # Missing EXIF does not cause rejection.
        # Tag 0x0112 is EXIF Orientation; 1 means upright / normal.
        exif = pil_image.getexif()
        exif_applied = bool(exif and 0x0112 in exif and exif[0x0112] > 1)
        try:
            pil_image = ImageOps.exif_transpose(pil_image)
        except Exception as exc:
            logger.debug("EXIF transposition bypassed or missing", error=str(exc))

        # Ensure standard RGB color space
        if pil_image.mode != "RGB":
            pil_image = pil_image.convert("RGB")

        orig_w, orig_h = pil_image.size
        total_pixels = orig_w * orig_h
        aspect_ratio = round(orig_w / orig_h, 4) if orig_h > 0 else 0.0

        if total_pixels > self.settings.max_image_pixels:
            return UploadResponse(
                status=AssessmentStatus.UNSUPPORTED_INPUT,
                reasons=[ReasonCode.EXCEEDS_PIXEL_LIMIT],
                message=(
                    f"Image contains {total_pixels} pixels, exceeding safety threshold "
                    f"of {self.settings.max_image_pixels} pixels."
                ),
                evidence_id=evidence_id,
                sha256=sha256_hash,
                thresholds=thresholds,
            )

        img_dimensions = ImageDimensions(
            width=orig_w,
            height=orig_h,
            channels=3,
            aspect_ratio=aspect_ratio,
            total_pixels=total_pixels,
        )

        file_metadata = FileMetadata(
            filename=filename,
            size_bytes=len(raw_bytes),
            mime_type=detected_mime,
            detected_format=pil_image.format or sig_info[1].lstrip(".").upper(),
            exif_orientation_corrected=exif_applied,
        )

        # Convert to numpy RGB array for OpenCV and MediaPipe
        rgb_arr = np.array(pil_image)

        # ── 7. Calculate Full-Image Quality Metrics ────────────────────────
        quality_metrics = self.calculate_quality_metrics(rgb_arr)

        # ── 8. Pretrained MediaPipe Face Detection ─────────────────────────
        try:
            detected_faces = self.face_detector.detect_faces(rgb_arr)
        except Exception as exc:
            logger.error("MediaPipe face detection failed", error=str(exc))
            return UploadResponse(
                status=AssessmentStatus.PROCESSING_ERROR,
                reasons=[ReasonCode.PROCESSING_FAILURE],
                message=f"Internal face detection failure: {exc}",
                evidence_id=evidence_id,
                sha256=sha256_hash,
                thresholds=thresholds,
            )

        # ── 9. Generate Normalized Derivative & Face Crop ───────────────────
        normalized_filename = f"{sha256_hash}_normalized.png"
        normalized_path = derivatives_dir / normalized_filename
        if not normalized_path.exists():
            pil_image.save(normalized_path, format="PNG", optimize=True)

        primary_face_crop_relpath: Optional[str] = None

        if detected_faces:
            # Sort faces by confidence descending; take primary face
            primary_face = max(detected_faces, key=lambda f: f.confidence)
            bbox = primary_face.bounding_box

            # Extract face crop with 15% contextual margin, clamped to bounds
            pad_x = int(bbox.width * 0.15)
            pad_y = int(bbox.height * 0.15)
            x1 = max(0, bbox.origin_x - pad_x)
            y1 = max(0, bbox.origin_y - pad_y)
            x2 = min(orig_w, bbox.origin_x + bbox.width + pad_x)
            y2 = min(orig_h, bbox.origin_y + bbox.height + pad_y)

            crop_arr = rgb_arr[y1:y2, x1:x2]
            crop_h, crop_w = crop_arr.shape[:2]

            if crop_w > 0 and crop_h > 0:
                crop_pil = Image.fromarray(crop_arr)
                crop_filename = f"{sha256_hash}_face_0.png"
                crop_filepath = derivatives_dir / crop_filename
                if not crop_filepath.exists():
                    crop_pil.save(crop_filepath, format="PNG", optimize=True)

                primary_face_crop_relpath = f"derivatives/{crop_filename}"

                # Calculate crop-specific quality metrics
                crop_quality = self.calculate_quality_metrics(crop_arr)
                primary_face.crop_dimensions = CropDimensions(
                    crop_width=crop_w,
                    crop_height=crop_h,
                    aspect_ratio=round(crop_w / crop_h, 4),
                )
                primary_face.crop_quality = crop_quality

        derivatives = EvidenceDerivatives(
            normalized_image_path=f"derivatives/{normalized_filename}",
            face_crop_path=primary_face_crop_relpath,
        )

        # ── 10. Status & Provisional Threshold Evaluation ─────────────────
        reasons: list[ReasonCode] = []

        # Resolution check
        if orig_w < self.settings.min_image_width or orig_h < self.settings.min_image_height:
            reasons.append(ReasonCode.LOW_RESOLUTION)

        # Sharpness check
        if not quality_metrics.is_sharp:
            reasons.append(ReasonCode.BLURRY_IMAGE)

        # Exposure checks
        if quality_metrics.brightness < self.settings.min_brightness:
            reasons.append(ReasonCode.UNDER_EXPOSED)
        elif quality_metrics.brightness > self.settings.max_brightness:
            reasons.append(ReasonCode.OVER_EXPOSED)

        # Contrast check
        if not quality_metrics.has_acceptable_contrast:
            reasons.append(ReasonCode.LOW_CONTRAST)

        # Face presence check
        # RULE: "Return NO_FACE_DETECTED when no face is detected.
        #        Do not claim that the image necessarily contains an animal or an object."
        if len(detected_faces) == 0:
            reasons.append(ReasonCode.NO_FACE_DETECTED)
        else:
            # Face crop dimension check
            primary_face = max(detected_faces, key=lambda f: f.confidence)
            if (
                primary_face.bounding_box.width < self.settings.min_face_width
                or primary_face.bounding_box.height < self.settings.min_face_height
            ):
                reasons.append(ReasonCode.FACE_TOO_SMALL)

        # Overall Status resolution
        if len(reasons) > 0:
            status = AssessmentStatus.RETRY_REQUIRED
            reason_str = ", ".join(r.value for r in reasons)
            message = f"Quality assessment requires retry due to: {reason_str}."
        else:
            status = AssessmentStatus.PASS
            message = "Image passed all forensic quality checks."

        return UploadResponse(
            status=status,
            reasons=reasons,
            message=message,
            evidence_id=evidence_id,
            sha256=sha256_hash,
            file_metadata=file_metadata,
            image_dimensions=img_dimensions,
            quality_metrics=quality_metrics,
            face_count=len(detected_faces),
            faces=detected_faces,
            derivatives=derivatives,
            thresholds=thresholds,
        )


_image_processor_service: Optional[ImageProcessorService] = None


def get_image_processor() -> ImageProcessorService:
    global _image_processor_service
    if _image_processor_service is None:
        _image_processor_service = ImageProcessorService()
    return _image_processor_service
