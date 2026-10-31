"""
ShieldHer – Comprehensive Unit Tests for Image Upload & Forensic Quality Assessment.

Tests:
1. Valid synthetic image passing quality checks with face detected (PASS).
2. Harmless synthetic image with NO face detected (RETRY_REQUIRED, NO_FACE_DETECTED).
3. Blurry synthetic image (RETRY_REQUIRED, BLURRY_IMAGE).
4. Under-exposed (severely dark) image (RETRY_REQUIRED, UNDER_EXPOSED).
5. Over-exposed (severely bright) image (RETRY_REQUIRED, OVER_EXPOSED).
6. Low resolution image (<200x200) (RETRY_REQUIRED, LOW_RESOLUTION).
7. Empty file fixture (UNSUPPORTED_INPUT, EMPTY_FILE, HTTP 400).
8. Malformed file with invalid magic bytes (UNSUPPORTED_INPUT, UNSUPPORTED_MAGIC_BYTES, HTTP 400).
9. Corrupted file with valid signature but unparseable payload (UNSUPPORTED_INPUT, DECODING_FAILED, HTTP 400).
10. File exceeding maximum permitted byte limit (UNSUPPORTED_INPUT, FILE_TOO_LARGE, HTTP 400).
11. Image without EXIF metadata does not fail or get rejected.
12. AI-generated/synthetic faces are allowed to proceed when quality thresholds are met.
13. Original byte-level SHA-256 cryptographic evidentiary integrity.
"""
from __future__ import annotations

import hashlib
import io
from pathlib import Path
from unittest.mock import patch

import numpy as np
import pytest
from httpx import ASGITransport, AsyncClient
from PIL import Image, ImageDraw

from app.main import create_app
from app.schemas.upload import (
    AssessmentStatus,
    BoundingBox,
    DetectedFace,
    KeypointInfo,
    ReasonCode,
)


@pytest.fixture(scope="module")
def app():
    return create_app()


@pytest.fixture
async def client(app):
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://testserver",
    ) as ac:
        yield ac


def make_synthetic_image(
    width: int = 400,
    height: int = 400,
    fmt: str = "JPEG",
    brightness: int = 128,
    add_texture: bool = True,
) -> bytes:
    """Generate a clean in-memory synthetic image."""
    arr = np.full((height, width, 3), brightness, dtype=np.uint8)
    if add_texture:
        # Add high-contrast gradient/grid pattern to yield sharp Laplacian edges
        for y in range(0, height, 20):
            arr[y : y + 10, :, :] = np.clip(brightness + 60, 0, 255)
        for x in range(0, width, 20):
            arr[:, x : x + 10, :] = np.clip(brightness - 60, 0, 255)

    img = Image.fromarray(arr, mode="RGB")
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    return buf.getvalue()


def make_mock_detected_face(width: int = 120, height: int = 140) -> DetectedFace:
    return DetectedFace(
        face_index=0,
        bounding_box=BoundingBox(
            origin_x=100,
            origin_y=100,
            width=width,
            height=height,
            normalized_xmin=0.25,
            normalized_ymin=0.25,
            normalized_width=0.30,
            normalized_height=0.35,
        ),
        confidence=0.95,
        keypoints=[
            KeypointInfo(name="right_eye", x=0.32, y=0.32, score=0.98),
            KeypointInfo(name="left_eye", x=0.48, y=0.32, score=0.97),
            KeypointInfo(name="nose_tip", x=0.40, y=0.42, score=0.95),
            KeypointInfo(name="mouth_center", x=0.40, y=0.52, score=0.94),
            KeypointInfo(name="right_ear_tragion", x=0.26, y=0.36, score=0.90),
            KeypointInfo(name="left_ear_tragion", x=0.54, y=0.36, score=0.89),
        ],
    )


# ── Test 1: Valid synthetic image passing quality checks (PASS) ───────────
@pytest.mark.asyncio
async def test_upload_valid_synthetic_image_pass(client):
    image_bytes = make_synthetic_image(width=400, height=400, add_texture=True)
    expected_sha256 = hashlib.sha256(image_bytes).hexdigest()

    mock_face = make_mock_detected_face()
    with patch(
        "app.services.image_processor.get_face_detector"
    ) as mock_get_detector:
        mock_detector = mock_get_detector.return_value
        mock_detector.detect_faces.return_value = [mock_face]

        response = await client.post(
            "/upload",
            files={"file": ("evidence.jpg", image_bytes, "image/jpeg")},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == AssessmentStatus.PASS.value
    assert data["reasons"] == []
    assert data["sha256"] == expected_sha256
    assert data["face_count"] == 1
    assert data["image_dimensions"]["width"] == 400
    assert data["image_dimensions"]["height"] == 400
    assert data["quality_metrics"]["is_sharp"] is True
    assert data["quality_metrics"]["is_well_exposed"] is True
    assert len(data["faces"]) == 1
    assert data["faces"][0]["confidence"] == 0.95
    assert len(data["faces"][0]["keypoints"]) == 6
    assert data["derivatives"]["normalized_image_path"] is not None
    assert data["derivatives"]["face_crop_path"] is not None
    assert data["thresholds"]["is_provisional"] is True


# ── Test 2: Harmless synthetic image with NO face detected ────────────────
@pytest.mark.asyncio
async def test_upload_no_face_detected(client):
    """
    CRITICAL REQUIREMENT:
    Return NO_FACE_DETECTED when no face is detected.
    Do not claim that the image necessarily contains an animal or an object.
    """
    image_bytes = make_synthetic_image(width=400, height=400, add_texture=True)

    with patch(
        "app.services.image_processor.get_face_detector"
    ) as mock_get_detector:
        mock_detector = mock_get_detector.return_value
        mock_detector.detect_faces.return_value = []  # No faces found

        response = await client.post(
            "/upload",
            files={"file": ("landscape.jpg", image_bytes, "image/jpeg")},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == AssessmentStatus.RETRY_REQUIRED.value
    assert ReasonCode.NO_FACE_DETECTED.value in data["reasons"]
    assert data["face_count"] == 0
    assert data["faces"] == []
    # Verify message does not make assumptions about animals or objects
    assert "animal" not in data["message"].lower()
    assert "object" not in data["message"].lower()


# ── Test 3: Blurry synthetic image (RETRY_REQUIRED, BLURRY_IMAGE) ──────────
@pytest.mark.asyncio
async def test_upload_blurry_image(client):
    # Flat uniform color has near-zero Laplacian variance (blurry)
    image_bytes = make_synthetic_image(width=400, height=400, add_texture=False)
    mock_face = make_mock_detected_face()

    with patch(
        "app.services.image_processor.get_face_detector"
    ) as mock_get_detector:
        mock_detector = mock_get_detector.return_value
        mock_detector.detect_faces.return_value = [mock_face]

        response = await client.post(
            "/upload",
            files={"file": ("blurry.jpg", image_bytes, "image/jpeg")},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == AssessmentStatus.RETRY_REQUIRED.value
    assert ReasonCode.BLURRY_IMAGE.value in data["reasons"]
    assert data["quality_metrics"]["is_sharp"] is False


# ── Test 4: Under-exposed (too dark) image ─────────────────────────────────
@pytest.mark.asyncio
async def test_upload_under_exposed_image(client):
    # Mean luminance 15 (below default threshold of 40)
    image_bytes = make_synthetic_image(width=400, height=400, brightness=15, add_texture=False)
    mock_face = make_mock_detected_face()

    with patch(
        "app.services.image_processor.get_face_detector"
    ) as mock_get_detector:
        mock_detector = mock_get_detector.return_value
        mock_detector.detect_faces.return_value = [mock_face]

        response = await client.post(
            "/upload",
            files={"file": ("dark.jpg", image_bytes, "image/jpeg")},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == AssessmentStatus.RETRY_REQUIRED.value
    assert ReasonCode.UNDER_EXPOSED.value in data["reasons"]


# ── Test 5: Over-exposed (too bright) image ────────────────────────────────
@pytest.mark.asyncio
async def test_upload_over_exposed_image(client):
    # Mean luminance 245 (above default threshold of 220)
    image_bytes = make_synthetic_image(width=400, height=400, brightness=245, add_texture=False)
    mock_face = make_mock_detected_face()

    with patch(
        "app.services.image_processor.get_face_detector"
    ) as mock_get_detector:
        mock_detector = mock_get_detector.return_value
        mock_detector.detect_faces.return_value = [mock_face]

        response = await client.post(
            "/upload",
            files={"file": ("bright.jpg", image_bytes, "image/jpeg")},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == AssessmentStatus.RETRY_REQUIRED.value
    assert ReasonCode.OVER_EXPOSED.value in data["reasons"]


# ── Test 6: Low resolution image (<200x200) ────────────────────────────────
@pytest.mark.asyncio
async def test_upload_low_resolution(client):
    image_bytes = make_synthetic_image(width=120, height=120, add_texture=True)
    mock_face = make_mock_detected_face(width=30, height=30)

    with patch(
        "app.services.image_processor.get_face_detector"
    ) as mock_get_detector:
        mock_detector = mock_get_detector.return_value
        mock_detector.detect_faces.return_value = [mock_face]

        response = await client.post(
            "/upload",
            files={"file": ("tiny.jpg", image_bytes, "image/jpeg")},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == AssessmentStatus.RETRY_REQUIRED.value
    assert ReasonCode.LOW_RESOLUTION.value in data["reasons"]


# ── Test 7: Empty file fixture (UNSUPPORTED_INPUT, HTTP 400) ───────────────
@pytest.mark.asyncio
async def test_upload_empty_file(client):
    response = await client.post(
        "/upload",
        files={"file": ("empty.jpg", b"", "image/jpeg")},
    )

    assert response.status_code == 400
    data = response.json()
    assert data["status"] == AssessmentStatus.UNSUPPORTED_INPUT.value
    assert ReasonCode.EMPTY_FILE.value in data["reasons"]


# ── Test 8: Malformed file with invalid magic bytes (HTTP 400) ─────────────
@pytest.mark.asyncio
async def test_upload_invalid_magic_bytes(client):
    text_payload = b"Plain text file masquerading as a JPEG image payload."
    response = await client.post(
        "/upload",
        files={"file": ("fake.jpg", text_payload, "image/jpeg")},
    )

    assert response.status_code == 400
    data = response.json()
    assert data["status"] == AssessmentStatus.UNSUPPORTED_INPUT.value
    assert ReasonCode.UNSUPPORTED_MAGIC_BYTES.value in data["reasons"]


# ── Test 9: Corrupted file with JPEG header but invalid body ───────────────
@pytest.mark.asyncio
async def test_upload_corrupt_jpeg(client):
    # Starts with JPEG SOI marker \xFF\xD8\xFF, but followed by corrupt garbage
    corrupt_bytes = b"\xFF\xD8\xFF\xE0" + b"\x00\x10JFIF\x00" + b"\xFF" * 50
    response = await client.post(
        "/upload",
        files={"file": ("corrupt.jpg", corrupt_bytes, "image/jpeg")},
    )

    assert response.status_code == 400
    data = response.json()
    assert data["status"] == AssessmentStatus.UNSUPPORTED_INPUT.value
    assert ReasonCode.DECODING_FAILED.value in data["reasons"]


# ── Test 10: File exceeding maximum permitted byte limit ───────────────────
@pytest.mark.asyncio
async def test_upload_file_too_large(client):
    # Temporarily set max_upload_bytes = 100 bytes
    image_bytes = make_synthetic_image(width=300, height=300)

    with patch("app.services.image_processor.get_settings") as mock_settings:
        from app.config import get_settings
        current = get_settings()
        mock_settings.return_value = current.model_copy(update={"max_upload_bytes": 100})

        response = await client.post(
            "/upload",
            files={"file": ("large.jpg", image_bytes, "image/jpeg")},
        )

    assert response.status_code == 400
    data = response.json()
    assert data["status"] == AssessmentStatus.UNSUPPORTED_INPUT.value
    assert ReasonCode.FILE_TOO_LARGE.value in data["reasons"]


# ── Test 11: Missing EXIF does not cause rejection ─────────────────────────
@pytest.mark.asyncio
async def test_upload_missing_exif_allowed(client):
    """
    CRITICAL REQUIREMENT:
    Missing EXIF metadata must not cause rejection.
    """
    # Standard PNG generated in-memory has zero EXIF tags
    png_bytes = make_synthetic_image(width=400, height=400, fmt="PNG", add_texture=True)
    mock_face = make_mock_detected_face()

    with patch(
        "app.services.image_processor.get_face_detector"
    ) as mock_get_detector:
        mock_detector = mock_get_detector.return_value
        mock_detector.detect_faces.return_value = [mock_face]

        response = await client.post(
            "/upload",
            files={"file": ("no_exif.png", png_bytes, "image/png")},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == AssessmentStatus.PASS.value
    assert data["file_metadata"]["exif_orientation_corrected"] is False


# ── Test 12: AI-generated/synthetic faces allowed when suitable ───────────
@pytest.mark.asyncio
async def test_upload_ai_synthetic_face_allowed_to_proceed(client):
    """
    CRITICAL REQUIREMENT:
    A detected face is not proof of a real human or an authentic photograph.
    AI-generated human faces must be allowed to proceed when suitable.
    Do not run deepfake classification in this module.
    """
    synthetic_ai_bytes = make_synthetic_image(width=512, height=512, fmt="PNG", add_texture=True)
    mock_face = make_mock_detected_face(width=180, height=200)

    with patch(
        "app.services.image_processor.get_face_detector"
    ) as mock_get_detector:
        mock_detector = mock_get_detector.return_value
        mock_detector.detect_faces.return_value = [mock_face]

        response = await client.post(
            "/upload",
            files={"file": ("ai_generated_avatar.png", synthetic_ai_bytes, "image/png")},
        )

    assert response.status_code == 200
    data = response.json()
    # It must PASS the quality assessment without being blocked
    assert data["status"] == AssessmentStatus.PASS.value
    assert data["face_count"] == 1


# ── Test 13: Evidentiary SHA-256 integrity ─────────────────────────────────
@pytest.mark.asyncio
async def test_upload_evidentiary_sha256_hash_integrity(client):
    image_bytes = make_synthetic_image(width=400, height=400, fmt="JPEG")
    expected_hash = hashlib.sha256(image_bytes).hexdigest()

    mock_face = make_mock_detected_face()
    with patch(
        "app.services.image_processor.get_face_detector"
    ) as mock_get_detector:
        mock_detector = mock_get_detector.return_value
        mock_detector.detect_faces.return_value = [mock_face]

        response = await client.post(
            "/upload",
            files={"file": ("original_evidence.jpg", image_bytes, "image/jpeg")},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["sha256"] == expected_hash
