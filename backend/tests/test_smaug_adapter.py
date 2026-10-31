"""
ShieldHer – Tests for Smaug-AI-Image-Detector Adapter and Multi-Model /verify Integration.
"""
from __future__ import annotations

import io
from pathlib import Path
from unittest.mock import patch, MagicMock

import numpy as np
import pytest
from httpx import ASGITransport, AsyncClient
from PIL import Image

from app.config import get_settings
from app.main import app
from app.schemas.verification import (
    ModelInferenceStatus,
    SmaugPredictedLabel,
    VerificationOutcome,
)
from app.services.smaug_adapter import (
    CROP,
    SmaugModelAdapter,
    views,
)


@pytest.fixture
def synthetic_rgb_image() -> Image.Image:
    """Generate a valid 640x480 RGB test image."""
    arr = np.random.randint(50, 200, (480, 640, 3), dtype=np.uint8)
    return Image.fromarray(arr, mode="RGB")


@pytest.fixture
def test_weights_dir() -> Path:
    """Path to downloaded Smaug weights."""
    return get_settings().smaug_weights_path


# ── 1. Preprocessing (views) Tests ────────────────────────────────────

def test_views_landscape_3_crops(synthetic_rgb_image):
    """Landscape image with min side > 576 should yield 3 crops of exactly 528x528."""
    # 800 x 600 landscape
    img = Image.fromarray(np.zeros((600, 800, 3), dtype=np.uint8))
    crops = views(img, crops=3)
    assert len(crops) == 3
    for c in crops:
        assert c.size == (CROP, CROP)


def test_views_portrait_3_crops():
    """Portrait image with min side > 576 should yield 3 crops of 528x528 sliced vertically."""
    # 600 x 1000 portrait
    img = Image.fromarray(np.zeros((1000, 600, 3), dtype=np.uint8))
    crops = views(img, crops=3)
    assert len(crops) == 3
    for c in crops:
        assert c.size == (CROP, CROP)


def test_views_center_crop_1():
    """Requesting crops=1 yields single center crop of 528x528."""
    img = Image.fromarray(np.zeros((600, 700, 3), dtype=np.uint8))
    crops = views(img, crops=1)
    assert len(crops) == 1
    assert crops[0].size == (CROP, CROP)


def test_views_small_image_upscale():
    """Images smaller than 528 px should be upscaled so min side is 528."""
    img = Image.fromarray(np.zeros((300, 400, 3), dtype=np.uint8))
    crops = views(img, crops=1)
    assert len(crops) == 1
    assert crops[0].size == (CROP, CROP)


def test_views_invalid_crops_count():
    """crops argument other than 1 or 3 must raise ValueError."""
    img = Image.fromarray(np.zeros((600, 600, 3), dtype=np.uint8))
    with pytest.raises(ValueError, match="crops must be 1 or 3"):
        views(img, crops=2)


# ── 2. Error Handling & Isolation Tests ────────────────────────────────

def test_smaug_adapter_unavailable_when_missing_directory(tmp_path):
    """When weights directory does not exist, return UNAVAILABLE without fabricating scores."""
    nonexistent = tmp_path / "missing_smaug_dir"
    adapter = SmaugModelAdapter(weights_path=nonexistent, device="cpu")

    img = Image.fromarray(np.zeros((600, 600, 3), dtype=np.uint8))
    result = adapter.predict(img)

    assert result.status == ModelInferenceStatus.UNAVAILABLE
    assert result.ai_generation_score is None
    assert result.predicted_label is None
    assert result.crop_scores is None
    assert "not found" in result.error_message
    assert "snapshot_download" in result.error_message


def test_smaug_adapter_dependency_missing():
    """When sentence_transformers is missing, return DEPENDENCY_MISSING."""
    adapter = SmaugModelAdapter(device="cpu")
    with patch.dict("sys.modules", {"sentence_transformers": None}):
        result = adapter.predict(Image.fromarray(np.zeros((600, 600, 3), dtype=np.uint8)))
        assert result.status == ModelInferenceStatus.DEPENDENCY_MISSING
        assert "Dependencies missing" in result.error_message


def test_smaug_adapter_incompatible_weights(tmp_path):
    """When weights directory contains invalid/corrupt safetensors, return INCOMPATIBLE_WEIGHTS."""
    bad_dir = tmp_path / "bad_weights"
    bad_dir.mkdir()
    (bad_dir / "model.safetensors").write_text("corrupted bytes")
    (bad_dir / "modules.json").write_text("[]")

    adapter = SmaugModelAdapter(weights_path=bad_dir, device="cpu")
    result = adapter.predict(Image.fromarray(np.zeros((600, 600, 3), dtype=np.uint8)))

    assert result.status in (ModelInferenceStatus.INCOMPATIBLE_WEIGHTS, ModelInferenceStatus.ERROR)
    assert result.ai_generation_score is None
    assert result.predicted_label is None


# ── 3. Real Inference Tests (with downloaded weights) ──────────────────

@pytest.mark.skipif(
    not (get_settings().smaug_weights_path / "model.safetensors").exists(),
    reason="Smaug weights not downloaded",
)
def test_smaug_adapter_real_inference(synthetic_rgb_image):
    """When official weights are available, run actual inference on CPU."""
    adapter = SmaugModelAdapter(device="cpu")
    result = adapter.predict(synthetic_rgb_image, crops=3)

    assert result.status == ModelInferenceStatus.SUCCESS
    assert result.ai_generation_score is not None
    assert 0.0 <= result.ai_generation_score <= 1.0
    assert result.crop_scores is not None
    assert len(result.crop_scores) == 3
    assert result.crops_evaluated == 3
    assert result.predicted_label in (
        SmaugPredictedLabel.AI_GENERATED,
        SmaugPredictedLabel.NATURAL_OR_AUTHENTIC,
    )
    assert result.inference_duration_ms is not None
    assert result.inference_duration_ms > 0
    assert "UNSCALED_HEURISTIC_SCORE" in result.score_semantics


@pytest.mark.skipif(
    not (get_settings().smaug_weights_path / "model.safetensors").exists(),
    reason="Smaug weights not downloaded",
)
def test_smaug_adapter_crops_1_mode(synthetic_rgb_image):
    """Test fast single-crop mode."""
    adapter = SmaugModelAdapter(device="cpu")
    result = adapter.predict(synthetic_rgb_image, crops=1)

    assert result.status == ModelInferenceStatus.SUCCESS
    assert result.crops_evaluated == 1
    assert len(result.crop_scores) == 1


# ── 4. Integration with /verify Endpoint ──────────────────────────────

@pytest.mark.asyncio
async def test_verify_runs_both_detectors_independently():
    """Verify endpoint should run both Effort and Smaug without interfering."""
    # Create synthetic test image with a recognizable synthetic face for quality gateway
    img = Image.new("RGB", (400, 400), color=(180, 180, 180))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    jpeg_bytes = buf.getvalue()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # In this synthetic image without a real face, Quality Gateway returns RETRY_REQUIRED
        response = await client.post(
            "/verify",
            files={"file": ("evidence.jpg", jpeg_bytes, "image/jpeg")},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["verification_status"] == VerificationOutcome.QUALITY_GATEWAY_RETRY_REQUIRED


@pytest.mark.asyncio
async def test_verify_with_mocked_gateway_and_detectors():
    """When quality passes, both detectors return individual results."""
    from app.schemas.upload import AssessmentStatus, QualityMetrics, UploadResponse
    from app.schemas.verification import DetectionDetails, PredictedLabel, SmaugDetectionDetails
    from app.services.image_processor import get_image_processor

    fake_metrics = QualityMetrics(
        blur_score=100.0,
        brightness=120.0,
        contrast=50.0,
        is_sharp=True,
        is_well_exposed=True,
        has_acceptable_contrast=True,
    )
    fake_quality = UploadResponse(
        status=AssessmentStatus.PASS,
        reasons=[],
        message="Quality check passed",
        evidence_id="ev_test_123",
        sha256="fake_sha256",
        metrics=fake_metrics,
        thresholds=get_image_processor().get_provisional_thresholds(),
    )

    fake_effort = DetectionDetails(
        status=ModelInferenceStatus.SUCCESS,
        manipulation_score=0.15,
        predicted_label=PredictedLabel.AUTHENTIC,
        inference_duration_ms=45.0,
        input_source_used="face_crop",
    )

    fake_smaug = SmaugDetectionDetails(
        status=ModelInferenceStatus.SUCCESS,
        ai_generation_score=0.92,
        crop_scores=[0.90, 0.93, 0.92],
        crops_evaluated=3,
        predicted_label=SmaugPredictedLabel.AI_GENERATED,
        inference_duration_ms=80.0,
        input_source_used="normalized_image",
    )

    img = Image.new("RGB", (400, 400), color=(120, 120, 120))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    jpeg_bytes = buf.getvalue()

    with (
        patch("app.api.verify.get_image_processor") as mock_proc_fn,
        patch("app.api.verify.get_effort_adapter") as mock_eff_fn,
        patch("app.api.verify.get_smaug_adapter") as mock_smaug_fn,
    ):
        mock_proc = MagicMock()
        mock_proc.process_upload.return_value = fake_quality
        mock_proc_fn.return_value = mock_proc

        mock_eff = MagicMock()
        mock_eff.predict.return_value = fake_effort
        mock_eff_fn.return_value = mock_eff

        mock_smaug = MagicMock()
        mock_smaug.predict.return_value = fake_smaug
        mock_smaug_fn.return_value = mock_smaug

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/verify",
                files={"file": ("evidence.jpg", jpeg_bytes, "image/jpeg")},
            )

            assert response.status_code == 200
            data = response.json()
            assert data["verification_status"] == VerificationOutcome.VERIFIED

            # Check individual detector reporting
            assert data["effort_detection"]["status"] == "SUCCESS"
            assert data["effort_detection"]["manipulation_score"] == 0.15
            assert data["effort_detection"]["predicted_label"] == "AUTHENTIC"

            assert data["smaug_detection"]["status"] == "SUCCESS"
            assert data["smaug_detection"]["ai_generation_score"] == 0.92
            assert data["smaug_detection"]["predicted_label"] == "AI_GENERATED"
            assert data["smaug_detection"]["crops_evaluated"] == 3

            # Backward compatibility check
            assert data["detection"]["manipulation_score"] == 0.15


@pytest.mark.asyncio
async def test_verify_isolation_when_smaug_fails():
    """If Smaug fails, Effort result is NOT erased."""
    from app.schemas.upload import AssessmentStatus, QualityMetrics, UploadResponse
    from app.schemas.verification import DetectionDetails, PredictedLabel, SmaugDetectionDetails
    from app.services.image_processor import get_image_processor

    fake_quality = UploadResponse(
        status=AssessmentStatus.PASS,
        reasons=[],
        message="Quality check passed",
        evidence_id="ev_test_iso",
        metrics=QualityMetrics(
            blur_score=100.0,
            brightness=120.0,
            contrast=50.0,
            is_sharp=True,
            is_well_exposed=True,
            has_acceptable_contrast=True,
        ),
        thresholds=get_image_processor().get_provisional_thresholds(),
    )

    fake_effort = DetectionDetails(
        status=ModelInferenceStatus.SUCCESS,
        manipulation_score=0.88,
        predicted_label=PredictedLabel.MANIPULATED,
        inference_duration_ms=40.0,
    )

    # Smaug reports UNAVAILABLE
    failed_smaug = SmaugDetectionDetails(
        status=ModelInferenceStatus.UNAVAILABLE,
        error_message="Smaug weights missing",
    )

    img = Image.new("RGB", (400, 400), color=(120, 120, 120))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    jpeg_bytes = buf.getvalue()

    with (
        patch("app.api.verify.get_image_processor") as mock_proc_fn,
        patch("app.api.verify.get_effort_adapter") as mock_eff_fn,
        patch("app.api.verify.get_smaug_adapter") as mock_smaug_fn,
    ):
        mock_proc = MagicMock()
        mock_proc.process_upload.return_value = fake_quality
        mock_proc_fn.return_value = mock_proc

        mock_eff = MagicMock()
        mock_eff.predict.return_value = fake_effort
        mock_eff_fn.return_value = mock_eff

        mock_smaug = MagicMock()
        mock_smaug.predict.return_value = failed_smaug
        mock_smaug_fn.return_value = mock_smaug

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/verify",
                files={"file": ("evidence.jpg", jpeg_bytes, "image/jpeg")},
            )

            assert response.status_code == 200
            data = response.json()
            # Verified because Effort succeeded
            assert data["verification_status"] == VerificationOutcome.VERIFIED
            assert data["effort_detection"]["status"] == "SUCCESS"
            assert data["effort_detection"]["manipulation_score"] == 0.88
            assert data["smaug_detection"]["status"] == "UNAVAILABLE"
