"""
ShieldHer – Forensic Analysis Schemas.

Defines structured response models for deterministic frequency-domain,
noise-residual, compression/resampling, spatial boundary forensic analysis,
and disclosures for PRNU sensor attribution and optional pretrained models (FSD, TruFor).

FORENSIC PRINCIPLE:
Deterministic measurements provide forensic clues and physical consistency checks.
They must NEVER be converted into arbitrary synthetic probabilities or treated as
certified proof of authenticity or manipulation.
"""
from __future__ import annotations

from enum import Enum
from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class AnalysisExecutionStatus(str, Enum):
    SUCCESS = "SUCCESS"
    NOT_APPLICABLE = "NOT_APPLICABLE"
    SKIPPED = "SKIPPED"
    DISABLED_BY_DEFAULT = "DISABLED_BY_DEFAULT"
    ERROR = "ERROR"


# ── A. Frequency Domain Schemas ────────────────────────────────────────

class FFTSpectrumDetails(BaseModel):
    method: str = "2D Fast Fourier Transform (FFT) & Radial Energy Decomposition"
    version: str = "1.0.0"
    log_magnitude_spectrum_path: Optional[str] = Field(
        default=None,
        description="Relative file path to normalized 2D log-magnitude spectrum visualization",
    )
    low_freq_energy_ratio: float = Field(
        description="Fraction of spectral energy in low radial frequency band (0 to 0.15 R_max)",
    )
    mid_freq_energy_ratio: float = Field(
        description="Fraction of spectral energy in mid radial frequency band (0.15 to 0.50 R_max)",
    )
    high_freq_energy_ratio: float = Field(
        description="Fraction of spectral energy in high radial frequency band (0.50 to 1.0 R_max)",
    )
    azimuthal_energy_variance: float = Field(
        description="Variance across 36 angular sectors; elevated values indicate directional grid spikes or ray artifacts",
    )
    limitations: str = (
        "Radial energy partitions depend on image resolution, sharpness, and scene content. "
        "High-frequency rolloff naturally occurs in soft or out-of-focus photographs."
    )


class DCTDetails(BaseModel):
    method: str = "2D Block Discrete Cosine Transform (8x8 Block Grid Analysis)"
    version: str = "1.0.0"
    dc_energy_ratio: float = Field(
        description="Ratio of DC coefficient energy across all 8x8 blocks to total energy",
    )
    low_ac_energy_ratio: float = Field(
        description="Ratio of low-frequency AC coefficient energy across all 8x8 blocks",
    )
    high_ac_energy_ratio: float = Field(
        description="Ratio of high-frequency AC coefficient energy across all 8x8 blocks",
    )
    limitations: str = (
        "DCT energy distribution reflects scene coarseness and JPEG quantization matrix profiles. "
        "Lossy recompression heavily dampens high-frequency AC coefficients."
    )


class WaveletDetails(BaseModel):
    method: str = "2D Discrete Wavelet Transform (2D DWT, Haar wavelet)"
    version: str = "1.0.0"
    wavelet_family: str = "haar"
    ll_energy_ratio: float = Field(
        description="Low-low approximation subband energy ratio (coarse structure)",
    )
    lh_energy_ratio: float = Field(
        description="Low-high detail subband energy ratio (horizontal features)",
    )
    hl_energy_ratio: float = Field(
        description="High-low detail subband energy ratio (vertical features)",
    )
    hh_energy_ratio: float = Field(
        description="High-high detail subband energy ratio (diagonal/corner features)",
    )
    limitations: str = (
        "Single-level Haar DWT subband ratios capture directional edge energy. "
        "Does not distinguish generative synthesis from fine physical textiles or textures."
    )


class FrequencyDomainResult(BaseModel):
    status: AnalysisExecutionStatus
    fft_spectrum: Optional[FFTSpectrumDetails] = None
    dct_analysis: Optional[DCTDetails] = None
    wavelet_analysis: Optional[WaveletDetails] = None
    error_message: Optional[str] = None


# ── B. Noise Residual Schemas ─────────────────────────────────────────

class HighPassResidualDetails(BaseModel):
    method: str = "Gaussian Difference High-Pass Residual Extraction"
    version: str = "1.0.0"
    residual_map_path: Optional[str] = Field(
        default=None,
        description="Relative file path to amplified high-pass residual visualization map",
    )
    residual_std: float = Field(description="Standard deviation of high-pass filtered pixel intensities")


class DenoisingResidualDetails(BaseModel):
    method: str = "Median Filter Denoising Residual Extraction (I - MedianBlur(I, k=3))"
    version: str = "1.0.0"
    residual_map_path: Optional[str] = Field(
        default=None,
        description="Relative file path to amplified denoising residual visualization map",
    )
    residual_mean: float = Field(description="Mean residual value across pixels")
    residual_std: float = Field(description="Standard deviation of residual values")
    residual_skewness: float = Field(description="Fisher-Pearson skewness of residual distribution")
    residual_kurtosis: float = Field(description="Excess kurtosis of residual distribution")


class NoiseResidualResult(BaseModel):
    status: AnalysisExecutionStatus
    high_pass_residual: Optional[HighPassResidualDetails] = None
    denoising_residual: Optional[DenoisingResidualDetails] = None
    disclaimer: str = (
        "EVIDENTIARY SAFETY DISCLAIMER: Noise residuals contain high-frequency scene edges, fine textures, "
        "and lossy compression artifacts. They must NEVER be labeled as pure camera sensor noise or PRNU. "
        "Residual variations naturally occur across different textures, focal planes, and lighting conditions."
    )
    error_message: Optional[str] = None


# ── C. Compression and Resampling Schemas ──────────────────────────────

class JPEGBlockinessDetails(BaseModel):
    method: str = "Fan & de Queiroz 8x8 JPEG Block Boundary Discontinuity Metric"
    version: str = "1.0.0"
    status: AnalysisExecutionStatus
    blockiness_metric: Optional[float] = Field(
        default=None,
        description="Ratio of average gradient along 8x8 block boundaries vs intra-block gradients. Values > 1.0 indicate detectable grid blockiness",
    )
    notes: str = Field(description="Diagnostic context and format applicability")


class ELADetails(BaseModel):
    method: str = "Error Level Analysis (ELA) at Configured Recompression Quality"
    version: str = "1.0.0"
    status: AnalysisExecutionStatus
    recompression_quality: int = Field(default=90, description="JPEG quality used for resaving difference")
    scale_factor: float = Field(default=10.0, description="Amplification multiplier for error visualization")
    mean_error: Optional[float] = Field(default=None, description="Average absolute pixel difference after recompression")
    max_error: Optional[float] = Field(default=None, description="Maximum absolute pixel difference after recompression")
    ela_map_path: Optional[str] = Field(
        default=None,
        description="Relative file path to amplified ELA visualization map",
    )
    notes: str = Field(description="Diagnostic context and format applicability")


class ResamplingIndicatorDetails(BaseModel):
    method: str = "Gallagher-Chen Periodic Second-Difference Spectral Peak Analysis"
    version: str = "1.0.0"
    status: AnalysisExecutionStatus
    periodic_peak_score: Optional[float] = Field(
        default=None,
        description="Normalized spectral peak magnitude in second-difference spectrum; values > 3.0 indicate potential periodic interpolation",
    )
    notes: str = Field(
        default=(
            "Detects periodic correlation artifacts introduced by linear/cubic interpolation during resizing or rotation. "
            "Heavy lossy compression or multi-pass resampling can suppress or blur periodic peaks."
        ),
    )


class CompressionResamplingResult(BaseModel):
    status: AnalysisExecutionStatus
    is_jpeg: bool = Field(description="Whether the original upload is a standard JPEG image")
    detected_format: str = Field(description="Format detected from magic bytes (JPEG, PNG, WEBP, etc.)")
    jpeg_blockiness: Optional[JPEGBlockinessDetails] = None
    ela: Optional[ELADetails] = None
    resampling_indicators: Optional[ResamplingIndicatorDetails] = None
    format_applicability_note: str = Field(
        description="Clarification that JPEG-specific diagnostics (ELA, 8x8 blockiness) do not apply to lossless PNG or non-DCT formats",
    )
    error_message: Optional[str] = None


# ── D. Spatial Analysis Schemas ────────────────────────────────────────

class FaceBoundarySpatialDetails(BaseModel):
    method: str = "Face Boundary Band & Local Texture Discontinuity Analysis"
    version: str = "1.0.0"
    face_detected: bool = Field(description="Whether a face was detected to anchor the boundary analysis")
    inner_face_laplacian_var: Optional[float] = Field(
        default=None,
        description="Laplacian variance (texture sharpness) of the inner face core region",
    )
    boundary_ring_laplacian_var: Optional[float] = Field(
        default=None,
        description="Laplacian variance of the transition ring around the face boundary",
    )
    outer_background_laplacian_var: Optional[float] = Field(
        default=None,
        description="Laplacian variance of the outer immediate background ring",
    )
    texture_discontinuity_ratio: Optional[float] = Field(
        default=None,
        description="Ratio of boundary ring sharpness to inner face sharpness; elevated values may indicate harsh cut-and-paste seams",
    )
    color_seam_delta_e: Optional[float] = Field(
        default=None,
        description="CIE Delta E (LAB color distance) across the inner and outer boundary ring",
    )
    boundary_visualization_path: Optional[str] = Field(
        default=None,
        description="Relative file path to spatial visualization overlay marking inner, boundary, and outer rings",
    )
    limitations: str = (
        "Natural depth-of-field blur (bokeh), hair, makeup, and directional lighting naturally create sharp boundary gradients. "
        "A high texture discontinuity ratio does NOT by itself prove face swapping or compositing."
    )


class SpatialAnalysisResult(BaseModel):
    status: AnalysisExecutionStatus
    face_boundary: Optional[FaceBoundarySpatialDetails] = None
    error_message: Optional[str] = None


# ── E. Optional Pretrained Forensic Models Schemas ─────────────────────

class PretrainedForensicModelDisclosure(BaseModel):
    model_name: str
    paper_reference: str
    official_repo: str
    license: str
    license_review_status: str = "PENDING_LEGAL_TERMS_REVIEW"
    is_enabled: bool = False
    status: AnalysisExecutionStatus = AnalysisExecutionStatus.DISABLED_BY_DEFAULT
    guidance: str


# ── F. PRNU Sensor Attribution Schema ──────────────────────────────────

class PRNUSensorAttributionDisclosure(BaseModel):
    status: str = "REFERENCE_FINGERPRINT_REQUIRED"
    prnu_supported_from_single_image: bool = False
    methodological_requirement: str = (
        "Camera-source attribution via Photo-Response Non-Uniformity (PRNU) strictly requires multiple reference images "
        "(typically 20-50 uniform flat-field or natural frames) from the suspect physical camera sensor, or an authenticated "
        "sensor fingerprint database. Claiming camera-source verification from a single query image without an authenticated "
        "reference fingerprint is scientifically invalid, prone to gross false positives, and inadmissible in legal proceedings."
    )


# ── Master Forensic Report Schema ──────────────────────────────────────

class ForensicReport(BaseModel):
    evidence_id: str
    status: AnalysisExecutionStatus
    sha256: Optional[str] = None
    frequency: FrequencyDomainResult
    noise_residuals: NoiseResidualResult
    compression_resampling: CompressionResamplingResult
    spatial: SpatialAnalysisResult
    optional_models: Dict[str, PretrainedForensicModelDisclosure]
    prnu: PRNUSensorAttributionDisclosure
    forensic_disclaimer: str = (
        "FORENSIC PRINCIPLE: Deterministic image forensics provides mathematical measurements of physical consistency "
        "(frequency distribution, noise residuals, compression grids, and boundary textures). "
        "These measurements are diagnostic clues and do NOT constitute calibrated posterior probabilities of forgery. "
        "They must be interpreted in conjunction with pretrained detection models (EFFORT, Smaug) and case context."
    )
