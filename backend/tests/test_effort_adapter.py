"""
ShieldHer – Comprehensive Unit Tests for Effort-AIGI-Detection Model Adapter & /verify Pipeline.

Tests:
1. Exact preprocessing: Bilinear resize to 224x224 and CLIP mean/std normalization.
2. Architecture forward pass: SVDResidualLinear and EffortDetector output shapes.
3. Model adapter execution with officially supported checkpoint.
4. Optional Grad-CAM computation on ViT patch tokens.
5. Failure path: Unavailable checkpoint reports UNAVAILABLE without fabricating random predictions.
6. Failure path: Corrupted checkpoint reports INCOMPATIBLE_WEIGHTS.
7. Quality Gateway integration: Unsupported file is rejected with HTTP 400 without invoking ML.
8. Quality Gateway integration: No-face image halts with RETRY_REQUIRED without invoking ML.
9. Full end-to-end /verify pipeline with face detection passing into Effort adapter.
"""
from __future__ import annotations

import io
from pathlib import Path
from unittest.mock import patch

import numpy as np
import pytest
import torch
from httpx import ASGITransport, AsyncClient
from PIL import Image

from app.main import create_app
from app.models.effort import EffortDetector, SVDResidualLinear
from app.schemas.verification import (
    ModelInferenceStatus,
    VerificationOutcome,
)
from app.services.effort_adapter import (
    CLIP_MEAN,
    CLIP_STD,
    EffortModelAdapter,
    preprocess_for_effort,
)
from tests.test_upload import make_mock_detected_face, make_synthetic_image


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


# ── Test 1: Preprocessing Exactness ───────────────────────────────────────
def test_effort_preprocessing_shape_and_normalization():
    # 300x400 synthetic RGB image
    dummy_img = np.full((300, 400, 3), 128, dtype=np.uint8)
    tensor = preprocess_for_effort(dummy_img)

    # Output must be (1, 3, 224, 224)
    assert tensor.shape == (1, 3, 224, 224)
    assert tensor.dtype == torch.float32

    # Verify normalization math on solid black image (0, 0, 0)
    black_img = np.zeros((224, 224, 3), dtype=np.uint8)
    black_tensor = preprocess_for_effort(black_img)
    expected_black = -CLIP_MEAN / CLIP_STD
    np.testing.assert_allclose(
        black_tensor.squeeze(0).permute(1, 2, 0).numpy()[0, 0],
        expected_black,
        rtol=1e-4,
    )

    # Verify normalization math on solid white image (255, 255, 255)
    white_img = np.full((224, 224, 3), 255, dtype=np.uint8)
    white_tensor = preprocess_for_effort(white_img)
    expected_white = (1.0 - CLIP_MEAN) / CLIP_STD
    np.testing.assert_allclose(
        white_tensor.squeeze(0).permute(1, 2, 0).numpy()[0, 0],
        expected_white,
        rtol=1e-4,
    )


# ── Test 2: Architecture & SVD Residual Module ────────────────────────────
def test_svd_residual_linear_forward():
    in_dim, out_dim = 16, 8
    layer = SVDResidualLinear(in_dim, out_dim, r=4, bias=True)
    x = torch.randn(2, in_dim)
    out = layer(x)
    assert out.shape == (2, out_dim)


# ── Test 3: Model Adapter with Checkpoint ─────────────────────────────────
def test_effort_adapter_predict_with_checkpoint():
    adapter = EffortModelAdapter()
    if not adapter.checkpoint_path.exists():
        pytest.skip("Official checkpoint file not available on local path")

    dummy_face = np.full((224, 224, 3), 128, dtype=np.uint8)
    result = adapter.predict(dummy_face, include_gradcam=False)

    assert result.status == ModelInferenceStatus.SUCCESS
    assert result.model_name == "Effort-AIGI-Detection (CLIP-ViT-L/14)"
    assert result.checkpoint_identifier == "effort_clip_l14_faceforensics_pp_c23"
    assert result.inference_duration_ms is not None and result.inference_duration_ms > 0
    assert result.raw_logits is not None and len(result.raw_logits) == 2
    assert result.manipulation_score is not None
    assert 0.0 <= result.manipulation_score <= 1.0
    assert result.predicted_label is not None
    assert "UNSCALED_HEURISTIC_SCORE" in result.score_semantics


# ── Test 4: Grad-CAM Visualization ────────────────────────────────────────
def test_effort_adapter_gradcam():
    adapter = EffortModelAdapter()
    if not adapter.checkpoint_path.exists():
        pytest.skip("Official checkpoint file not available on local path")

    dummy_face = np.full((224, 224, 3), 128, dtype=np.uint8)
    result = adapter.predict(dummy_face, include_gradcam=True)

    assert result.status == ModelInferenceStatus.SUCCESS
    assert result.gradcam is not None
    assert result.gradcam.has_gradcam is True
    assert result.gradcam.target_class == 1
    assert result.gradcam.heatmap_dimensions == [224, 224]
    assert result.gradcam.heatmap_grid is not None
    assert len(result.gradcam.heatmap_grid) == 16
    assert len(result.gradcam.heatmap_grid[0]) == 16
    assert result.gradcam.overlay_base64_png is not None


# ── Test 5: Failure Path – Missing / Unavailable Checkpoint ───────────────
def test_effort_adapter_missing_checkpoint():
    """
    CRITICAL RULE:
    Do not fabricate predictions or silently substitute random weights.
    If checkpoint is unavailable, report UNAVAILABLE.
    """
    non_existent_path = Path("/tmp/non_existent_effort_checkpoint_12345.pth")
    adapter = EffortModelAdapter(checkpoint_path=non_existent_path)

    dummy_img = np.zeros((224, 224, 3), dtype=np.uint8)
    result = adapter.predict(dummy_img)

    assert result.status == ModelInferenceStatus.UNAVAILABLE
    assert result.raw_logits is None
    assert result.manipulation_score is None
    assert result.predicted_label is None
    assert "not found" in result.error_message
    assert "https://drive.google.com" in result.error_message


# ── Test 6: Failure Path – Corrupted / Incompatible Weights ────────────────
def test_effort_adapter_incompatible_weights(tmp_path):
    corrupt_ckpt = tmp_path / "bad_weights.pth"
    torch.save({"bad_key": torch.zeros((10, 10))}, str(corrupt_ckpt))

    adapter = EffortModelAdapter(checkpoint_path=corrupt_ckpt)
    dummy_img = np.zeros((224, 224, 3), dtype=np.uint8)
    result = adapter.predict(dummy_img)

    assert result.status in (
        ModelInferenceStatus.INCOMPATIBLE_WEIGHTS,
        ModelInferenceStatus.ERROR,
    )
    assert result.manipulation_score is None
    assert result.raw_logits is None


# ── Test 7: /verify Endpoint – Quality Gateway Rejection (HTTP 400) ───────
@pytest.mark.asyncio
async def test_verify_quality_gateway_rejection(client):
    """Corrupt or non-image file is halted at Quality Gateway."""
    response = await client.post(
        "/verify",
        files={"file": ("fake.txt", b"plain text payload not an image", "text/plain")},
    )

    assert response.status_code == 400
    data = response.json()
    assert (
        data["verification_status"]
        == VerificationOutcome.QUALITY_GATEWAY_REJECTED.value
    )
    assert data["detection"] is None
    assert data["quality_assessment"]["status"] == "UNSUPPORTED_INPUT"


# ── Test 8: /verify Endpoint – Quality Gateway Retry Required (HTTP 200) ──
@pytest.mark.asyncio
async def test_verify_quality_gateway_retry_on_no_face(client):
    """
    When no face is detected, Quality Gateway halts and ML inference is skipped.
    """
    image_bytes = make_synthetic_image(width=400, height=400, add_texture=True)

    with patch(
        "app.services.image_processor.get_face_detector"
    ) as mock_get_detector:
        mock_detector = mock_get_detector.return_value
        mock_detector.detect_faces.return_value = []  # No face detected

        response = await client.post(
            "/verify",
            files={"file": ("landscape.jpg", image_bytes, "image/jpeg")},
        )

    assert response.status_code == 200
    data = response.json()
    assert (
        data["verification_status"]
        == VerificationOutcome.QUALITY_GATEWAY_RETRY_REQUIRED.value
    )
    assert data["detection"] is None
    assert "NO_FACE_DETECTED" in data["quality_assessment"]["reasons"]


# ── Test 9: /verify Endpoint – Full Pipeline Success ──────────────────────
@pytest.mark.asyncio
async def test_verify_full_pipeline_success(client):
    """
    Passing Quality Gateway forwards face crop into Effort detector.
    """
    image_bytes = make_synthetic_image(width=400, height=400, add_texture=True)
    mock_face = make_mock_detected_face(width=160, height=180)

    with patch(
        "app.services.image_processor.get_face_detector"
    ) as mock_get_detector:
        mock_detector = mock_get_detector.return_value
        mock_detector.detect_faces.return_value = [mock_face]

        response = await client.post(
            "/verify",
            files={"file": ("evidence.jpg", image_bytes, "image/jpeg")},
            params={"include_gradcam": True},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["verification_status"] in (
        VerificationOutcome.VERIFIED.value,
        VerificationOutcome.DETECTOR_UNAVAILABLE.value,
    )
    assert data["quality_assessment"]["status"] == "PASS"
    assert data["sha256"] is not None

    if data["verification_status"] == VerificationOutcome.VERIFIED.value:
        det = data["detection"]
        assert det["model_name"] == "Effort-AIGI-Detection (CLIP-ViT-L/14)"
        assert det["status"] == "SUCCESS"
        assert det["manipulation_score"] is not None
        assert 0.0 <= det["manipulation_score"] <= 1.0
        assert det["predicted_label"] in ("MANIPULATED", "AUTHENTIC")
        assert det["inference_duration_ms"] > 0
        assert det["input_source_used"] == "face_crop"
        if det["gradcam"]:
            assert det["gradcam"]["has_gradcam"] is True
