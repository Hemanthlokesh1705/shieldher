"""
Tests for Forensic Self-Descriptions (FSD) Model Adapter.
"""
from pathlib import Path
from unittest.mock import patch
import numpy as np
import pytest

from app.config import get_settings
from app.schemas.verification import ModelInferenceStatus
from app.services.fsd_adapter import FSDModelAdapter, get_fsd_adapter


def test_fsd_adapter_singleton():
    a1 = get_fsd_adapter()
    a2 = get_fsd_adapter()
    assert a1 is a2


def test_fsd_adapter_lazy_initialization():
    adapter = FSDModelAdapter()
    assert adapter._initialized is False
    assert adapter._detector is None


def test_fsd_licensing_guard_when_disabled():
    with patch("app.services.fsd_adapter.get_settings") as mock_settings:
        mock = MagicMock = get_settings().model_copy(update={"enable_fsd": False})
        mock_settings.return_value = mock

        adapter = FSDModelAdapter()
        dummy_img = np.full((256, 256, 3), 128, dtype=np.uint8)
        res = adapter.predict(dummy_img)

        assert res.status == ModelInferenceStatus.SKIPPED
        assert "disabled per configuration" in res.error_message.lower()
        assert "CC BY-NC-SA 4.0" in res.licensing_notice


def test_fsd_missing_checkpoint():
    with patch("app.services.fsd_adapter.get_settings") as mock_settings:
        mock = get_settings().model_copy(update={"enable_fsd": True})
        mock_settings.return_value = mock

        adapter = FSDModelAdapter(weights_dir=Path("/nonexistent/fsd/path"))
        dummy_img = np.full((256, 256, 3), 128, dtype=np.uint8)
        res = adapter.predict(dummy_img)

        assert res.status == ModelInferenceStatus.UNAVAILABLE
        assert "not found" in res.error_message.lower()


def test_fsd_real_inference_success():
    adapter = get_fsd_adapter()
    dummy_img = np.full((256, 256, 3), 128, dtype=np.uint8)
    res = adapter.predict(dummy_img)

    assert res.status == ModelInferenceStatus.SUCCESS
    assert res.model_name == "Forensic-Self-Descriptions (FSD)"
    assert res.checkpoint_id == "ductai199x/Forensic-Self-Descriptions-CVPR25"
    assert res.native_z_score is not None
    assert res.is_fake is not None
    assert res.model_derived_decision in ("AI_GENERATED", "AUTHENTIC")
    assert res.threshold_used == -2.0
    assert res.inference_duration_ms is not None
    assert res.inference_duration_ms > 0
    assert "FORENSIC_Z_SCORE" in res.documented_score_interpretation
