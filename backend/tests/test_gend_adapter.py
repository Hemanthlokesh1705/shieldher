"""
Tests for GenD (CLIP-ViT-L/14) Model Adapter.
"""
from pathlib import Path
from unittest.mock import MagicMock, patch
import numpy as np
import pytest
import torch

from app.schemas.verification import ModelInferenceStatus
from app.services.gend_adapter import GenDModelAdapter, get_gend_adapter


def test_gend_adapter_singleton():
    a1 = get_gend_adapter()
    a2 = get_gend_adapter()
    assert a1 is a2


def test_gend_adapter_lazy_initialization():
    adapter = GenDModelAdapter()
    assert adapter._initialized is False
    assert adapter._model is None


def test_gend_missing_checkpoint():
    adapter = GenDModelAdapter(weights_dir=Path("/nonexistent/gend/path"))
    dummy_img = np.full((224, 224, 3), 128, dtype=np.uint8)
    res = adapter.predict(dummy_img)
    assert res.status == ModelInferenceStatus.UNAVAILABLE
    assert "not found" in res.error_message.lower()
    assert res.raw_logits is None
    assert res.genuine_score is None


def test_gend_real_inference_success():
    adapter = get_gend_adapter()
    dummy_img = np.full((224, 224, 3), 128, dtype=np.uint8)
    res = adapter.predict(dummy_img)

    assert res.status == ModelInferenceStatus.SUCCESS
    assert res.model_name == "GenD (CLIP-ViT-L/14)"
    assert res.checkpoint_id == "yermandy/GenD_CLIP_L_14"
    assert res.raw_logits is not None
    assert len(res.raw_logits) == 2
    assert res.class_scores is not None
    assert "authentic" in res.class_scores
    assert "manipulated" in res.class_scores
    assert res.genuine_score is not None
    assert res.fake_score is not None
    assert abs((res.genuine_score + res.fake_score) - 1.0) < 1e-3
    assert res.predicted_class in ("authentic", "manipulated")
    assert res.inference_duration_ms is not None
    assert res.inference_duration_ms > 0
    assert "UNSCALED_HEURISTIC_SCORE" in res.score_semantics
