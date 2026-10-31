"""
ShieldHer – Tests for Deterministic Forensic Analysis Suite.

Tests:
1. Frequency Domain: 2D FFT, radial energy bands, 2D block DCT, and 2D Haar DWT.
2. Noise Residuals: High-pass residual, median filter residual moments, and evidentiary disclaimer.
3. Compression & Resampling: 8x8 JPEG blockiness, ELA on JPEG, PNG format isolation, and Gallagher-Chen resampling peaks.
4. Spatial Analysis: Face boundary margin, Laplacian texture ratios, CIE LAB Delta E color seams, and no-face fallback.
5. Pretrained Models Disclosure: FSD and TruFor disabled by default with license terms.
6. PRNU Sensor Attribution: Single-image attribution rejected with methodological requirement.
7. API Endpoint: POST /analyze/forensics with JPEG and PNG evidence.
8. API Endpoint: POST /verify?include_forensics=true integration.
"""
from __future__ import annotations

import io
from pathlib import Path
from unittest.mock import MagicMock, patch

import cv2
import numpy as np
import pytest
from httpx import ASGITransport, AsyncClient
from PIL import Image

from app.config import get_settings
from app.main import app
from app.schemas.forensics import (
    AnalysisExecutionStatus,
    ForensicReport,
)
from app.schemas.upload import BoundingBox, DetectedFace
from app.services.forensic_service import (
    ForensicAnalysisService,
    get_forensic_service,
)


@pytest.fixture
def synthetic_jpeg_bytes() -> bytes:
    """Generate a valid 400x400 JPEG image with texture."""
    arr = np.random.randint(40, 220, (400, 400, 3), dtype=np.uint8)
    pil_img = Image.fromarray(arr)
    buf = io.BytesIO()
    pil_img.save(buf, format="JPEG", quality=95)
    return buf.getvalue()


@pytest.fixture
def synthetic_png_bytes() -> bytes:
    """Generate a valid 400x400 PNG image with sharp graphics."""
    arr = np.zeros((400, 400, 3), dtype=np.uint8)
    cv2.circle(arr, (200, 200), 80, (255, 100, 50), -1)
    pil_img = Image.fromarray(arr)
    buf = io.BytesIO()
    pil_img.save(buf, format="PNG")
    return buf.getvalue()


@pytest.fixture
def sample_detected_face() -> DetectedFace:
    """Mock detected face for boundary spatial testing."""
    return DetectedFace(
        face_index=0,
        bounding_box=BoundingBox(
            origin_x=100,
            origin_y=80,
            width=180,
            height=200,
            normalized_xmin=0.25,
            normalized_ymin=0.20,
            normalized_width=0.45,
            normalized_height=0.50,
        ),
        confidence=0.98,
        keypoints=[],
    )


# ── 1. Frequency Domain Tests ──────────────────────────────────────────

def test_frequency_domain_fft_and_energy_bands(tmp_path):
    """FFT log-magnitude spectrum is saved and radial energy bands sum to 1.0."""
    service = ForensicAnalysisService(diagnostics_dir=tmp_path)
    rgb = np.random.randint(50, 200, (300, 300, 3), dtype=np.uint8)

    res = service.analyze_frequency_domain(rgb, evidence_id="ev_freq_test")

    assert res.status == AnalysisExecutionStatus.SUCCESS
    assert res.fft_spectrum is not None

    # Check spectrum visualization file exists
    spec_path = tmp_path / "ev_freq_test_fft_spectrum.png"
    assert spec_path.exists()
    assert spec_path.stat().st_size > 0

    # Ratios sum to approx 1.0
    fft = res.fft_spectrum
    total_ratio = fft.low_freq_energy_ratio + fft.mid_freq_energy_ratio + fft.high_freq_energy_ratio
    assert pytest.approx(total_ratio, abs=0.01) == 1.0
    assert fft.azimuthal_energy_variance >= 0.0


def test_frequency_domain_dct_energy(tmp_path):
    """2D block DCT energy ratios sum to approx 1.0."""
    service = ForensicAnalysisService(diagnostics_dir=tmp_path)
    rgb = np.random.randint(50, 200, (256, 256, 3), dtype=np.uint8)

    res = service.analyze_frequency_domain(rgb, evidence_id="ev_dct_test")
    assert res.dct_analysis is not None
    dct = res.dct_analysis

    total_dct = dct.dc_energy_ratio + dct.low_ac_energy_ratio + dct.high_ac_energy_ratio
    assert pytest.approx(total_dct, abs=0.01) == 1.0
    assert 0.0 <= dct.dc_energy_ratio <= 1.0


def test_frequency_domain_wavelet_subbands(tmp_path):
    """2D Haar DWT subband ratios (LL, LH, HL, HH) sum to approx 1.0."""
    service = ForensicAnalysisService(diagnostics_dir=tmp_path)
    rgb = np.random.randint(50, 200, (256, 256, 3), dtype=np.uint8)

    res = service.analyze_frequency_domain(rgb, evidence_id="ev_wavelet_test")
    assert res.wavelet_analysis is not None
    w = res.wavelet_analysis

    assert w.wavelet_family == "haar"
    total_w = w.ll_energy_ratio + w.lh_energy_ratio + w.hl_energy_ratio + w.hh_energy_ratio
    assert pytest.approx(total_w, abs=0.01) == 1.0


# ── 2. Noise Residual Tests ────────────────────────────────────────────

def test_noise_residuals_extraction_and_moments(tmp_path):
    """Residuals are extracted, moment statistics computed, and files saved."""
    service = ForensicAnalysisService(diagnostics_dir=tmp_path)
    rgb = np.random.randint(50, 200, (300, 300, 3), dtype=np.uint8)

    res = service.analyze_noise_residuals(rgb, evidence_id="ev_noise_test")

    assert res.status == AnalysisExecutionStatus.SUCCESS
    assert res.high_pass_residual is not None
    assert res.denoising_residual is not None

    # Check visualization files exist
    hp_file = tmp_path / "ev_noise_test_high_pass_residual.png"
    denoise_file = tmp_path / "ev_noise_test_denoising_residual.png"
    assert hp_file.exists()
    assert denoise_file.exists()

    # Moment statistics check
    den = res.denoising_residual
    assert den.residual_std > 0.0
    assert isinstance(den.residual_skewness, float)
    assert isinstance(den.residual_kurtosis, float)

    # Evidentiary safety disclaimer check
    assert "NEVER be labeled as pure camera sensor noise" in res.disclaimer


# ── 3. Compression and Resampling Tests ────────────────────────────────

def test_compression_analysis_jpeg(tmp_path):
    """JPEG image computes blockiness and ELA maps."""
    service = ForensicAnalysisService(diagnostics_dir=tmp_path)
    rgb = np.random.randint(50, 200, (320, 320, 3), dtype=np.uint8)

    res = service.analyze_compression_and_resampling(rgb, detected_format="JPEG", evidence_id="ev_comp_jpg")

    assert res.status == AnalysisExecutionStatus.SUCCESS
    assert res.is_jpeg is True
    assert res.jpeg_blockiness.status == AnalysisExecutionStatus.SUCCESS
    assert res.jpeg_blockiness.blockiness_metric is not None

    assert res.ela.status == AnalysisExecutionStatus.SUCCESS
    assert res.ela.mean_error is not None
    assert res.ela.max_error is not None
    ela_file = tmp_path / f"ev_comp_jpg_ela_quality_90.png"
    assert ela_file.exists()

    assert res.resampling_indicators.status == AnalysisExecutionStatus.SUCCESS
    assert res.resampling_indicators.periodic_peak_score is not None


def test_compression_analysis_png_safe_isolation(tmp_path):
    """PNG image marks JPEG-specific metrics (blockiness, ELA) as NOT_APPLICABLE."""
    service = ForensicAnalysisService(diagnostics_dir=tmp_path)
    rgb = np.random.randint(50, 200, (300, 300, 3), dtype=np.uint8)

    res = service.analyze_compression_and_resampling(rgb, detected_format="PNG", evidence_id="ev_comp_png")

    assert res.status == AnalysisExecutionStatus.SUCCESS
    assert res.is_jpeg is False
    assert res.jpeg_blockiness.status == AnalysisExecutionStatus.NOT_APPLICABLE
    assert res.jpeg_blockiness.blockiness_metric is None
    assert res.ela.status == AnalysisExecutionStatus.NOT_APPLICABLE
    assert res.ela.mean_error is None

    # Resampling is format-agnostic and should still succeed
    assert res.resampling_indicators.status == AnalysisExecutionStatus.SUCCESS


def test_resampling_indicator_on_interpolated_image(tmp_path):
    """Gallagher-Chen resampling indicator detects periodic peaks on scaled image."""
    service = ForensicAnalysisService(diagnostics_dir=tmp_path)
    # Create small textured image and upsample by 2x using linear interpolation
    small = np.random.randint(50, 200, (150, 150, 3), dtype=np.uint8)
    resampled = cv2.resize(small, (300, 300), interpolation=cv2.INTER_LINEAR)

    res = service.analyze_compression_and_resampling(resampled, detected_format="PNG", evidence_id="ev_resamp")
    score = res.resampling_indicators.periodic_peak_score
    assert score is not None
    assert score > 0.0


# ── 4. Spatial Analysis Tests ──────────────────────────────────────────

def test_spatial_analysis_with_face(tmp_path, sample_detected_face):
    """Spatial face boundary analysis computes texture ratios, Delta E, and saves overlay."""
    service = ForensicAnalysisService(diagnostics_dir=tmp_path)
    rgb = np.random.randint(50, 200, (400, 400, 3), dtype=np.uint8)

    res = service.analyze_spatial_boundary(rgb, detected_faces=[sample_detected_face], evidence_id="ev_spat_face")

    assert res.status == AnalysisExecutionStatus.SUCCESS
    assert res.face_boundary is not None
    assert res.face_boundary.face_detected is True
    assert res.face_boundary.inner_face_laplacian_var is not None
    assert res.face_boundary.boundary_ring_laplacian_var is not None
    assert res.face_boundary.texture_discontinuity_ratio is not None
    assert res.face_boundary.color_seam_delta_e is not None

    overlay_file = tmp_path / "ev_spat_face_face_boundary_analysis.png"
    assert overlay_file.exists()


def test_spatial_analysis_no_face(tmp_path):
    """When no face is detected, spatial analysis returns NOT_APPLICABLE without error."""
    service = ForensicAnalysisService(diagnostics_dir=tmp_path)
    rgb = np.random.randint(50, 200, (400, 400, 3), dtype=np.uint8)

    res = service.analyze_spatial_boundary(rgb, detected_faces=[], evidence_id="ev_spat_noface")

    assert res.status == AnalysisExecutionStatus.NOT_APPLICABLE
    assert res.face_boundary.face_detected is False


# ── 5. Pretrained Models & PRNU Disclosures Tests ──────────────────────

def test_optional_models_disabled_by_default():
    """FSD and TruFor must be disabled by default with license disclosures."""
    service = get_forensic_service()
    models = service.get_optional_models_disclosure()

    assert "fsd" in models
    assert "trufor" in models

    fsd = models["fsd"]
    assert fsd.is_enabled is False
    assert fsd.status == AnalysisExecutionStatus.DISABLED_BY_DEFAULT
    assert "CC BY-NC-SA 4.0" in fsd.license
    assert "Forensic-Self-Descriptions" in fsd.official_repo

    trufor = models["trufor"]
    assert trufor.is_enabled is False
    assert trufor.status == AnalysisExecutionStatus.DISABLED_BY_DEFAULT
    assert "GRIP-UNINA" in trufor.license
    assert "TruFor" in trufor.official_repo


def test_prnu_single_image_attribution_rejected():
    """Single-image camera attribution is rejected without reference fingerprint."""
    service = get_forensic_service()
    prnu = service.get_prnu_disclosure()

    assert prnu.status == "REFERENCE_FINGERPRINT_REQUIRED"
    assert prnu.prnu_supported_from_single_image is False
    assert "strictly requires multiple reference images" in prnu.methodological_requirement


# ── 6. Full Forensic Report Master Generator Test ─────────────────────

def test_generate_forensic_report_master(tmp_path, sample_detected_face):
    """Master pipeline aggregates all sub-analyses into a comprehensive ForensicReport."""
    service = ForensicAnalysisService(diagnostics_dir=tmp_path)
    rgb = np.random.randint(50, 200, (320, 320, 3), dtype=np.uint8)

    report = service.generate_forensic_report(
        rgb_image=rgb,
        evidence_id="ev_master_001",
        detected_format="JPEG",
        detected_faces=[sample_detected_face],
        sha256="abc123sha",
    )

    assert isinstance(report, ForensicReport)
    assert report.status == AnalysisExecutionStatus.SUCCESS
    assert report.evidence_id == "ev_master_001"
    assert report.frequency.status == AnalysisExecutionStatus.SUCCESS
    assert report.noise_residuals.status == AnalysisExecutionStatus.SUCCESS
    assert report.compression_resampling.status == AnalysisExecutionStatus.SUCCESS
    assert report.spatial.status == AnalysisExecutionStatus.SUCCESS
    assert "FORENSIC PRINCIPLE" in report.forensic_disclaimer


# ── 7. API Endpoint Tests: POST /analyze/forensics ─────────────────────

@pytest.mark.asyncio
async def test_api_analyze_forensics_endpoint_jpeg(synthetic_jpeg_bytes):
    """POST /analyze/forensics with valid JPEG returns complete 200 report."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/analyze/forensics",
            files={"file": ("evidence.jpg", synthetic_jpeg_bytes, "image/jpeg")},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "SUCCESS"
        assert data["compression_resampling"]["is_jpeg"] is True
        assert data["compression_resampling"]["ela"]["status"] == "SUCCESS"
        assert data["frequency"]["fft_spectrum"]["low_freq_energy_ratio"] is not None
        assert "prnu" in data
        assert data["prnu"]["prnu_supported_from_single_image"] is False


@pytest.mark.asyncio
async def test_api_analyze_forensics_endpoint_png(synthetic_png_bytes):
    """POST /analyze/forensics with PNG isolates ELA and blockiness."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/analyze/forensics",
            files={"file": ("evidence.png", synthetic_png_bytes, "image/png")},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["compression_resampling"]["is_jpeg"] is False
        assert data["compression_resampling"]["ela"]["status"] == "NOT_APPLICABLE"


@pytest.mark.asyncio
async def test_api_analyze_forensics_hyphen_alias_endpoint(synthetic_jpeg_bytes):
    """POST /analyze-forensics (alias) with valid JPEG returns complete 200 report."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/analyze-forensics",
            files={"file": ("evidence.jpg", synthetic_jpeg_bytes, "image/jpeg")},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "SUCCESS"
        assert "frequency" in data
        assert "spatial" in data
        assert "compression_resampling" in data


# ── 8. API Endpoint Tests: POST /verify?include_forensics=true ─────────

@pytest.mark.asyncio
async def test_api_verify_with_include_forensics_true(synthetic_jpeg_bytes):
    """POST /verify with include_forensics=true returns forensic_report alongside verification."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/verify",
            files={"file": ("evidence.jpg", synthetic_jpeg_bytes, "image/jpeg")},
            params={"include_forensics": True},
        )
        assert response.status_code == 200
        data = response.json()
        # Quality assessment halts or passes, and schema supports forensic_report field
        assert "forensic_report" in data
