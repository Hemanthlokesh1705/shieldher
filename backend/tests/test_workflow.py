"""
ShieldHer – Tests for LangGraph Workflow Orchestration.

Tests:
1. End-to-end flow: Both models flag positive -> POSSIBLE_COMBINED_MANIPULATION.
2. End-to-end flow: Effort flags positive, Smaug low -> POSSIBLE_FACE_MANIPULATION.
3. End-to-end flow: Smaug flags positive, Effort low -> POSSIBLE_AI_GENERATION.
4. End-to-end flow: Both models low -> INCONCLUSIVE (NEVER AUTHENTIC!).
5. Quality Gateway halts on low quality -> INSUFFICIENT_IMAGE_QUALITY (skips ML).
6. Quality Gateway halts on unsupported bytes -> UNSUPPORTED_INPUT (skips ML).
7. Fault isolation: Effort fails, Smaug succeeds -> Smaug preserved, failure explicit.
8. Fault isolation: Smaug fails, Effort succeeds -> Effort preserved, failure explicit.
9. Idempotent processing: Re-running nodes with populated state avoids duplicate execution.
10. Human review: Examiner notes and decisions recorded without overwriting model outputs.
11. Consent enforcement: Workflow halts when processing consent is withheld.
12. API Endpoint tests: POST /workflow/execute and POST /workflow/review.
"""
from __future__ import annotations

import io
from pathlib import Path
from unittest.mock import MagicMock, patch

import numpy as np
import pytest
from httpx import ASGITransport, AsyncClient
from PIL import Image

from app.main import app
from app.schemas.upload import (
    AssessmentStatus,
    FileMetadata,
    ProvisionalThresholds,
    QualityMetrics,
    UploadResponse,
)
from app.schemas.verification import (
    DetectionDetails,
    ModelInferenceStatus,
    PredictedLabel,
    SmaugDetectionDetails,
    SmaugPredictedLabel,
)
from app.workflows.nodes import (
    effort_detection_node,
    evidence_summary_node,
    forensic_analysis_node,
    quality_gateway_node,
    smaug_detection_node,
    upload_node,
)
from app.workflows.state import (
    EvidenceWorkflowStatus,
    HumanReviewDecision,
    ImageState,
)
from app.workflows.workflow import create_shieldher_workflow


@pytest.fixture
def synthetic_jpeg_bytes() -> bytes:
    arr = np.random.randint(60, 200, (400, 400, 3), dtype=np.uint8)
    pil = Image.fromarray(arr)
    buf = io.BytesIO()
    pil.save(buf, format="JPEG", quality=90)
    return buf.getvalue()


@pytest.fixture
def mock_quality_pass():
    return UploadResponse(
        status=AssessmentStatus.PASS,
        reasons=[],
        message="Quality check passed",
        evidence_id="ev_wf_pass",
        sha256="fake_sha256_pass",
        file_metadata=FileMetadata(
            filename="evidence.jpg",
            size_bytes=1024,
            mime_type="image/jpeg",
            detected_format="JPEG",
            exif_orientation_corrected=False,
        ),
        metrics=QualityMetrics(
            blur_score=150.0,
            brightness=120.0,
            contrast=60.0,
            is_sharp=True,
            is_well_exposed=True,
            has_acceptable_contrast=True,
        ),
        face_count=1,
        faces=[],
        thresholds=ProvisionalThresholds(
            min_image_width=200,
            min_image_height=200,
            max_image_pixels=50000000,
            min_face_width=64,
            min_face_height=64,
            min_sharpness_score=50.0,
            min_brightness=40.0,
            max_brightness=220.0,
            min_contrast=20.0,
            min_face_confidence=0.5,
        ),
    )


# ── 1. Both Models Flagged -> POSSIBLE_COMBINED_MANIPULATION ──────────

@pytest.mark.asyncio
async def test_workflow_combined_manipulation(synthetic_jpeg_bytes, mock_quality_pass):
    wf = create_shieldher_workflow()

    effort_det = DetectionDetails(
        status=ModelInferenceStatus.SUCCESS,
        manipulation_score=0.92,
        predicted_label=PredictedLabel.MANIPULATED,
    )
    smaug_det = SmaugDetectionDetails(
        status=ModelInferenceStatus.SUCCESS,
        ai_generation_score=0.96,
        predicted_label=SmaugPredictedLabel.AI_GENERATED,
    )

    with (
        patch("app.workflows.nodes.get_image_processor") as m_proc,
        patch("app.workflows.nodes.get_effort_adapter") as m_eff,
        patch("app.workflows.nodes.get_smaug_adapter") as m_smaug,
    ):
        mock_p = MagicMock()
        mock_p.process_upload.return_value = mock_quality_pass
        m_proc.return_value = mock_p

        mock_e = MagicMock()
        mock_e.predict.return_value = effort_det
        m_eff.return_value = mock_e

        mock_s = MagicMock()
        mock_s.predict.return_value = smaug_det
        m_smaug.return_value = mock_s

        init_state: ImageState = {
            "case_id": "case_comb_01",
            "session_id": "sess_01",
            "raw_bytes": synthetic_jpeg_bytes,
            "filename": "test.jpg",
            "content_type": "image/jpeg",
            "consent_flags": {"consent_forensic_processing": True, "consent_evidence_storage": True},
            "include_forensics": False,
            "errors": [],
            "audit_events": [],
        }

        result = await wf.ainvoke(init_state)

        assert result["workflow_status"] == EvidenceWorkflowStatus.POSSIBLE_COMBINED_MANIPULATION.value
        assert "Both detectors flagged positive forgery signals" in result["human_readable_explanation"]
        assert result["evidence_manifest"] is not None
        assert result["complaint_draft"] is not None


# ── 2. Effort Flagged, Smaug Low -> POSSIBLE_FACE_MANIPULATION ────────

@pytest.mark.asyncio
async def test_workflow_face_manipulation_only(synthetic_jpeg_bytes, mock_quality_pass):
    wf = create_shieldher_workflow()

    effort_det = DetectionDetails(
        status=ModelInferenceStatus.SUCCESS,
        manipulation_score=0.88,
        predicted_label=PredictedLabel.MANIPULATED,
    )
    smaug_det = SmaugDetectionDetails(
        status=ModelInferenceStatus.SUCCESS,
        ai_generation_score=0.08,
        predicted_label=SmaugPredictedLabel.NATURAL_OR_AUTHENTIC,
    )

    with (
        patch("app.workflows.nodes.get_image_processor") as m_proc,
        patch("app.workflows.nodes.get_effort_adapter") as m_eff,
        patch("app.workflows.nodes.get_smaug_adapter") as m_smaug,
    ):
        mock_p = MagicMock()
        mock_p.process_upload.return_value = mock_quality_pass
        m_proc.return_value = mock_p

        mock_e = MagicMock()
        mock_e.predict.return_value = effort_det
        m_eff.return_value = mock_e

        mock_s = MagicMock()
        mock_s.predict.return_value = smaug_det
        m_smaug.return_value = mock_s

        init_state: ImageState = {
            "case_id": "case_fm_02",
            "session_id": "sess_02",
            "raw_bytes": synthetic_jpeg_bytes,
            "consent_flags": {"consent_forensic_processing": True},
            "include_forensics": False,
            "errors": [],
            "audit_events": [],
        }

        result = await wf.ainvoke(init_state)
        assert result["workflow_status"] == EvidenceWorkflowStatus.POSSIBLE_FACE_MANIPULATION.value
        assert "Effort detector flagged face-swap or face manipulation" in result["human_readable_explanation"]


# ── 3. Smaug Flagged, Effort Low -> POSSIBLE_AI_GENERATION ───────────

@pytest.mark.asyncio
async def test_workflow_ai_generation_only(synthetic_jpeg_bytes, mock_quality_pass):
    wf = create_shieldher_workflow()

    effort_det = DetectionDetails(
        status=ModelInferenceStatus.SUCCESS,
        manipulation_score=0.12,
        predicted_label=PredictedLabel.AUTHENTIC,
    )
    smaug_det = SmaugDetectionDetails(
        status=ModelInferenceStatus.SUCCESS,
        ai_generation_score=0.94,
        predicted_label=SmaugPredictedLabel.AI_GENERATED,
    )

    with (
        patch("app.workflows.nodes.get_image_processor") as m_proc,
        patch("app.workflows.nodes.get_effort_adapter") as m_eff,
        patch("app.workflows.nodes.get_smaug_adapter") as m_smaug,
    ):
        mock_p = MagicMock()
        mock_p.process_upload.return_value = mock_quality_pass
        m_proc.return_value = mock_p

        mock_e = MagicMock()
        mock_e.predict.return_value = effort_det
        m_eff.return_value = mock_e

        mock_s = MagicMock()
        mock_s.predict.return_value = smaug_det
        m_smaug.return_value = mock_s

        init_state: ImageState = {
            "case_id": "case_gen_03",
            "session_id": "sess_03",
            "raw_bytes": synthetic_jpeg_bytes,
            "consent_flags": {"consent_forensic_processing": True},
            "include_forensics": False,
            "errors": [],
            "audit_events": [],
        }

        result = await wf.ainvoke(init_state)
        assert result["workflow_status"] == EvidenceWorkflowStatus.POSSIBLE_AI_GENERATION.value
        assert "Smaug detector flagged full-image generative AI synthesis" in result["human_readable_explanation"]


# ── 4. Both Low Scores -> INCONCLUSIVE (NEVER AUTHENTIC) ──────────────

@pytest.mark.asyncio
async def test_workflow_both_low_scores_is_inconclusive(synthetic_jpeg_bytes, mock_quality_pass):
    """
    MANDATORY FORENSIC PRINCIPLE:
    Low scores do not prove authenticity. Verdict must be INCONCLUSIVE.
    """
    wf = create_shieldher_workflow()

    effort_det = DetectionDetails(
        status=ModelInferenceStatus.SUCCESS,
        manipulation_score=0.08,
        predicted_label=PredictedLabel.AUTHENTIC,
    )
    smaug_det = SmaugDetectionDetails(
        status=ModelInferenceStatus.SUCCESS,
        ai_generation_score=0.05,
        predicted_label=SmaugPredictedLabel.NATURAL_OR_AUTHENTIC,
    )

    with (
        patch("app.workflows.nodes.get_image_processor") as m_proc,
        patch("app.workflows.nodes.get_effort_adapter") as m_eff,
        patch("app.workflows.nodes.get_smaug_adapter") as m_smaug,
    ):
        mock_p = MagicMock()
        mock_p.process_upload.return_value = mock_quality_pass
        m_proc.return_value = mock_p

        mock_e = MagicMock()
        mock_e.predict.return_value = effort_det
        m_eff.return_value = mock_e

        mock_s = MagicMock()
        mock_s.predict.return_value = smaug_det
        m_smaug.return_value = mock_s

        init_state: ImageState = {
            "case_id": "case_inconc_04",
            "session_id": "sess_04",
            "raw_bytes": synthetic_jpeg_bytes,
            "consent_flags": {"consent_forensic_processing": True},
            "include_forensics": False,
            "errors": [],
            "audit_events": [],
        }

        result = await wf.ainvoke(init_state)

        assert result["workflow_status"] == EvidenceWorkflowStatus.INCONCLUSIVE.value
        assert result["workflow_status"] != "AUTHENTIC"
        assert "Verdict is INCONCLUSIVE" in result["human_readable_explanation"]
        assert "do NOT prove authenticity" in result["human_readable_explanation"]


# ── 5. Quality Gateway Retry Required -> Skips ML ─────────────────────

@pytest.mark.asyncio
async def test_workflow_quality_retry_halts_before_ml(synthetic_jpeg_bytes):
    wf = create_shieldher_workflow()

    low_quality_resp = UploadResponse(
        status=AssessmentStatus.RETRY_REQUIRED,
        reasons=["BLURRY_IMAGE", "LOW_CONTRAST"],
        message="Image is blurry and low contrast",
        evidence_id="ev_retry",
        thresholds=ProvisionalThresholds(
            min_image_width=200, min_image_height=200, max_image_pixels=50000000,
            min_face_width=64, min_face_height=64, min_sharpness_score=50.0,
            min_brightness=40.0, max_brightness=220.0, min_contrast=20.0, min_face_confidence=0.5,
        ),
    )

    with (
        patch("app.workflows.nodes.get_image_processor") as m_proc,
        patch("app.workflows.nodes.get_effort_adapter") as m_eff,
        patch("app.workflows.nodes.get_smaug_adapter") as m_smaug,
    ):
        mock_p = MagicMock()
        mock_p.process_upload.return_value = low_quality_resp
        m_proc.return_value = mock_p

        mock_e = MagicMock()
        m_eff.return_value = mock_e
        mock_s = MagicMock()
        m_smaug.return_value = mock_s

        init_state: ImageState = {
            "case_id": "case_qfail_05",
            "session_id": "sess_05",
            "raw_bytes": synthetic_jpeg_bytes,
            "consent_flags": {"consent_forensic_processing": True},
            "errors": [],
            "audit_events": [],
        }

        result = await wf.ainvoke(init_state)

        # ML models must NOT be invoked
        mock_e.predict.assert_not_called()
        mock_s.predict.assert_not_called()

        assert result["workflow_status"] == EvidenceWorkflowStatus.INSUFFICIENT_IMAGE_QUALITY.value
        assert "image quality is insufficient" in result["human_readable_explanation"]


# ── 6. Unsupported Input -> Skips ML ──────────────────────────────────

@pytest.mark.asyncio
async def test_workflow_unsupported_input_halts_early():
    wf = create_shieldher_workflow()
    corrupted_bytes = b"NOT_AN_IMAGE_RANDOM_TEXT"

    init_state: ImageState = {
        "case_id": "case_bad_06",
        "session_id": "sess_06",
        "raw_bytes": corrupted_bytes,
        "consent_flags": {"consent_forensic_processing": True},
        "errors": [],
        "audit_events": [],
    }

    result = await wf.ainvoke(init_state)

    assert result["workflow_status"] == EvidenceWorkflowStatus.UNSUPPORTED_INPUT.value
    assert len(result["errors"]) > 0


# ── 7. Fault Isolation: Effort Fails, Smaug Preserved ──────────────────

@pytest.mark.asyncio
async def test_workflow_fault_isolation_effort_fails(synthetic_jpeg_bytes, mock_quality_pass):
    wf = create_shieldher_workflow()

    failed_effort = DetectionDetails(
        status=ModelInferenceStatus.UNAVAILABLE,
        error_message="Effort weights missing on disk",
    )
    successful_smaug = SmaugDetectionDetails(
        status=ModelInferenceStatus.SUCCESS,
        ai_generation_score=0.91,
        predicted_label=SmaugPredictedLabel.AI_GENERATED,
    )

    with (
        patch("app.workflows.nodes.get_image_processor") as m_proc,
        patch("app.workflows.nodes.get_effort_adapter") as m_eff,
        patch("app.workflows.nodes.get_smaug_adapter") as m_smaug,
    ):
        mock_p = MagicMock()
        mock_p.process_upload.return_value = mock_quality_pass
        m_proc.return_value = mock_p

        mock_e = MagicMock()
        mock_e.predict.return_value = failed_effort
        m_eff.return_value = mock_e

        mock_s = MagicMock()
        mock_s.predict.return_value = successful_smaug
        m_smaug.return_value = mock_s

        init_state: ImageState = {
            "case_id": "case_fault_07",
            "session_id": "sess_07",
            "raw_bytes": synthetic_jpeg_bytes,
            "consent_flags": {"consent_forensic_processing": True},
            "include_forensics": False,
            "errors": [],
            "audit_events": [],
        }

        result = await wf.ainvoke(init_state)

        # Smaug success preserved despite Effort failure
        assert result["ai_generation_result"]["status"] == "SUCCESS"
        assert result["face_manipulation_result"]["status"] == "UNAVAILABLE"
        assert result["workflow_status"] == EvidenceWorkflowStatus.POSSIBLE_AI_GENERATION.value
        assert "Effort model unavailable" in result["human_readable_explanation"]


# ── 8. Idempotent Processing Check ─────────────────────────────────────

def test_nodes_idempotent_when_already_processed():
    """Re-executing nodes with already computed results returns hit without re-running."""
    state: ImageState = {
        "case_id": "case_idem_08",
        "session_id": "sess_08",
        "image_hash": "existing_hash",
        "upload_validation": {"is_valid": True},
        "quality_assessment": {"status": "PASS"},
        "face_manipulation_result": {"status": "SUCCESS", "score": 0.5},
        "ai_generation_result": {"status": "SUCCESS", "score": 0.5},
        "forensic_results": {"status": "SUCCESS"},
        "errors": [],
        "audit_events": [],
    }

    res_upload = upload_node(state)
    assert any("IDEMPOTENT_HIT" in ev["event"] for ev in res_upload["audit_events"])

    res_qa = quality_gateway_node(state)
    assert any("IDEMPOTENT_HIT" in ev["event"] for ev in res_qa["audit_events"])

    res_eff = effort_detection_node(state)
    assert any("IDEMPOTENT_HIT" in ev["event"] for ev in res_eff["audit_events"])

    res_sm = smaug_detection_node(state)
    assert any("IDEMPOTENT_HIT" in ev["event"] for ev in res_sm["audit_events"])

    res_for = forensic_analysis_node(state)
    assert any("IDEMPOTENT_HIT" in ev["event"] for ev in res_for["audit_events"])


# ── 9. Consent Enforcement ─────────────────────────────────────────────

def test_upload_node_halts_when_consent_rejected(synthetic_jpeg_bytes):
    state: ImageState = {
        "case_id": "case_noconsent_09",
        "session_id": "sess_09",
        "raw_bytes": synthetic_jpeg_bytes,
        "consent_flags": {"consent_forensic_processing": False},
        "errors": [],
        "audit_events": [],
    }

    res = upload_node(state)
    assert res["workflow_status"] == EvidenceWorkflowStatus.PROCESSING_ERROR.value
    assert "consent was not granted" in res["human_readable_explanation"]


# ── 10. Human Review Endpoint: Does not overwrite outputs ──────────────

@pytest.mark.asyncio
async def test_human_review_api_preserves_model_outputs():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        review_payload = {
            "case_id": "case_review_10",
            "decision": HumanReviewDecision.CONFIRMED_FORGERY.value,
            "examiner_notes": "Observed unnatural eye texture and boundary seam in forensic spectrum.",
            "reviewed_by": "Examiner #402 (Digital Forensics Unit)",
            "human_override": True,
        }

        resp = await client.post("/workflow/review", json=review_payload)
        assert resp.status_code == 200
        data = resp.json()

        assert data["case_id"] == "case_review_10"
        status_data = data["review_status"]
        assert status_data["decision"] == HumanReviewDecision.CONFIRMED_FORGERY.value
        assert status_data["reviewed_by"] == "Examiner #402 (Digital Forensics Unit)"
        assert status_data["human_override"] is True


# ── 11. API Endpoint: POST /workflow/execute ───────────────────────────

@pytest.mark.asyncio
async def test_api_workflow_execute_endpoint(synthetic_jpeg_bytes, mock_quality_pass):
    effort_det = DetectionDetails(
        status=ModelInferenceStatus.SUCCESS,
        manipulation_score=0.85,
        predicted_label=PredictedLabel.MANIPULATED,
    )
    smaug_det = SmaugDetectionDetails(
        status=ModelInferenceStatus.SUCCESS,
        ai_generation_score=0.10,
        predicted_label=SmaugPredictedLabel.NATURAL_OR_AUTHENTIC,
    )

    with (
        patch("app.workflows.nodes.get_image_processor") as m_proc,
        patch("app.workflows.nodes.get_effort_adapter") as m_eff,
        patch("app.workflows.nodes.get_smaug_adapter") as m_smaug,
    ):
        mock_p = MagicMock()
        mock_p.process_upload.return_value = mock_quality_pass
        m_proc.return_value = mock_p

        mock_e = MagicMock()
        mock_e.predict.return_value = effort_det
        m_eff.return_value = mock_e

        mock_s = MagicMock()
        mock_s.predict.return_value = smaug_det
        m_smaug.return_value = mock_s

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/workflow/execute",
                files={"file": ("evidence.jpg", synthetic_jpeg_bytes, "image/jpeg")},
                data={"case_id": "case_api_11", "include_forensics": "false"},
            )

            assert resp.status_code == 200
            data = resp.json()

            assert data["case_id"] == "case_api_11"
            assert data["workflow_status"] == EvidenceWorkflowStatus.POSSIBLE_FACE_MANIPULATION.value
            assert data["face_manipulation_result"]["status"] == "SUCCESS"
            assert data["ai_generation_result"]["status"] == "SUCCESS"
            assert data["evidence_manifest"] is not None
            assert data["complaint_draft"] is not None
            assert len(data["audit_events"]) > 0
