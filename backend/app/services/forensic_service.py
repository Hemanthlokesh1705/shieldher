"""
ShieldHer – Deterministic Forensic Analysis Service.

Implements mathematical and physical forensic analysis using OpenCV, NumPy, SciPy, and PyWavelets:
A. Frequency Domain:
   - 2D FFT and log-magnitude spectrum visualization.
   - Radial low, mid, and high frequency-band energy decomposition.
   - Azimuthal directional energy variance (periodic grid/ray detection).
   - 2D block DCT energy distribution (DC, low AC, high AC).
   - 2D Discrete Wavelet Transform (Haar DWT subband ratios).
B. Noise Residuals:
   - Gaussian difference high-pass residual extraction.
   - Median filter denoising residual extraction with statistical moments (mean, std, skewness, kurtosis).
   - Strict evidentiary disclaimer: residuals are NOT labeled as pure sensor noise.
C. Compression & Resampling:
   - Fan & de Queiroz 8x8 JPEG block boundary discontinuity metric.
   - Error Level Analysis (ELA) with configurable recompression quality.
   - Format safeguard: JPEG assumptions are NOT applied to PNG or WebP.
   - Gallagher-Chen periodic second-difference spectral peak analysis for resampling.
D. Spatial Analysis:
   - Face boundary seam texture & sharpness transition analysis.
   - CIE LAB Delta E color discontinuity across boundary margins.
   - Annotated diagnostic visual overlays.
E. Optional Pretrained Models Disclosure (FSD & TruFor):
   - Disabled by default with full license review disclosure.
F. PRNU Sensor Attribution Disclosure:
   - Methodological requirement: single-image camera attribution without reference fingerprint is rejected.
"""
from __future__ import annotations

import io
import math
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Union

import cv2
import numpy as np
from PIL import Image
import pywt
import scipy.fft
import scipy.stats
import structlog

from app.config import get_settings
from app.schemas.forensics import (
    AnalysisExecutionStatus,
    CompressionResamplingResult,
    DCTDetails,
    DenoisingResidualDetails,
    ELADetails,
    FaceBoundarySpatialDetails,
    FFTSpectrumDetails,
    ForensicReport,
    FrequencyDomainResult,
    HighPassResidualDetails,
    JPEGBlockinessDetails,
    NoiseResidualResult,
    PretrainedForensicModelDisclosure,
    PRNUSensorAttributionDisclosure,
    ResamplingIndicatorDetails,
    SpatialAnalysisResult,
    WaveletDetails,
)
from app.schemas.upload import DetectedFace

logger = structlog.get_logger(__name__)


class ForensicAnalysisService:
    """
    Deterministic forensic analysis engine.
    """

    _instance: Optional["ForensicAnalysisService"] = None

    def __init__(self, diagnostics_dir: Optional[Path] = None):
        self._custom_diagnostics_dir = diagnostics_dir

    @property
    def settings(self):
        return get_settings()

    @property
    def diagnostics_dir(self) -> Path:
        d = self._custom_diagnostics_dir or self.settings.forensic_diagnostics_dir
        d.mkdir(parents=True, exist_ok=True)
        return d

    # ── A. Frequency Domain Analysis ──────────────────────────────────

    def analyze_frequency_domain(
        self,
        rgb_image: np.ndarray,
        evidence_id: str,
    ) -> FrequencyDomainResult:
        """
        Compute 2D FFT, log-magnitude visualization, radial energy bands,
        2D block DCT energy, and 2D DWT subband ratios.
        """
        try:
            # 1. Grayscale conversion
            gray = cv2.cvtColor(rgb_image, cv2.COLOR_RGB2GRAY).astype(np.float32)
            h, w = gray.shape

            # 2. 2D FFT & Log-Magnitude Spectrum
            fft = np.fft.fft2(gray)
            fft_shift = np.fft.fftshift(fft)
            mag = np.abs(fft_shift)
            log_mag = np.log1p(mag)

            # Normalize log-magnitude for diagnostic visualization
            norm_log_mag = cv2.normalize(log_mag, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
            spectrum_filename = f"{evidence_id}_fft_spectrum.png"
            spectrum_path = self.diagnostics_dir / spectrum_filename
            cv2.imwrite(str(spectrum_path), norm_log_mag)
            rel_spectrum_path = f"diagnostics/{spectrum_filename}"

            # 3. Radial Frequency-Band Energy Decomposition
            cy, cx = h // 2, w // 2
            y_coords, x_coords = np.ogrid[:h, :w]
            dist_from_center = np.sqrt((x_coords - cx) ** 2 + (y_coords - cy) ** 2)
            max_radius = np.sqrt(cx**2 + cy**2)

            power = mag**2
            total_power = np.sum(power) + 1e-12

            low_band_mask = dist_from_center < (0.15 * max_radius)
            mid_band_mask = (dist_from_center >= (0.15 * max_radius)) & (dist_from_center < (0.50 * max_radius))
            high_band_mask = dist_from_center >= (0.50 * max_radius)

            low_energy_ratio = round(float(np.sum(power[low_band_mask]) / total_power), 4)
            mid_energy_ratio = round(float(np.sum(power[mid_band_mask]) / total_power), 4)
            high_energy_ratio = round(float(np.sum(power[high_band_mask]) / total_power), 4)

            # Azimuthal directional energy variance across 36 sectors (10 degrees each)
            angles = np.arctan2(y_coords - cy, x_coords - cx)  # [-pi, pi]
            sector_energies = []
            num_sectors = 36
            sector_step = (2 * np.pi) / num_sectors
            for i in range(num_sectors):
                start_angle = -np.pi + i * sector_step
                end_angle = start_angle + sector_step
                sector_mask = (angles >= start_angle) & (angles < end_angle)
                sector_energies.append(float(np.sum(power[sector_mask])))
            sector_sum = sum(sector_energies) + 1e-12
            norm_sectors = [e / sector_sum for e in sector_energies]
            azimuthal_var = round(float(np.var(norm_sectors) * 1000.0), 4)

            fft_details = FFTSpectrumDetails(
                log_magnitude_spectrum_path=rel_spectrum_path,
                low_freq_energy_ratio=low_energy_ratio,
                mid_freq_energy_ratio=mid_energy_ratio,
                high_freq_energy_ratio=high_energy_ratio,
                azimuthal_energy_variance=azimuthal_var,
            )

            # 4. 2D Block DCT Analysis (8x8 grid)
            # Crop to multiple of 8
            h8, w8 = (h // 8) * 8, (w // 8) * 8
            gray_crop = gray[:h8, :w8]

            dc_energy = 0.0
            low_ac_energy = 0.0
            high_ac_energy = 0.0

            # Grid coords for an 8x8 block
            u, v = np.meshgrid(np.arange(8), np.arange(8))
            low_ac_mask = (u + v <= 4) & ~((u == 0) & (v == 0))
            high_ac_mask = u + v > 4

            for row in range(0, h8, 8):
                for col in range(0, w8, 8):
                    block = gray_crop[row : row + 8, col : col + 8]
                    dct_block = scipy.fft.dctn(block, norm="ortho")
                    p_block = dct_block**2
                    dc_energy += float(p_block[0, 0])
                    low_ac_energy += float(np.sum(p_block[low_ac_mask]))
                    high_ac_energy += float(np.sum(p_block[high_ac_mask]))

            total_dct_energy = dc_energy + low_ac_energy + high_ac_energy + 1e-12
            dct_details = DCTDetails(
                dc_energy_ratio=round(dc_energy / total_dct_energy, 4),
                low_ac_energy_ratio=round(low_ac_energy / total_dct_energy, 4),
                high_ac_energy_ratio=round(high_ac_energy / total_dct_energy, 4),
            )

            # 5. 2D Discrete Wavelet Analysis (Haar DWT)
            coeffs = pywt.dwt2(gray, "haar")
            ll, (lh, hl, hh) = coeffs
            e_ll = float(np.sum(ll**2))
            e_lh = float(np.sum(lh**2))
            e_hl = float(np.sum(hl**2))
            e_hh = float(np.sum(hh**2))
            total_wavelet_energy = e_ll + e_lh + e_hl + e_hh + 1e-12

            wavelet_details = WaveletDetails(
                wavelet_family="haar",
                ll_energy_ratio=round(e_ll / total_wavelet_energy, 4),
                lh_energy_ratio=round(e_lh / total_wavelet_energy, 4),
                hl_energy_ratio=round(e_hl / total_wavelet_energy, 4),
                hh_energy_ratio=round(e_hh / total_wavelet_energy, 4),
            )

            return FrequencyDomainResult(
                status=AnalysisExecutionStatus.SUCCESS,
                fft_spectrum=fft_details,
                dct_analysis=dct_details,
                wavelet_analysis=wavelet_details,
            )

        except Exception as exc:
            logger.error("Frequency domain analysis failed", error=str(exc))
            return FrequencyDomainResult(
                status=AnalysisExecutionStatus.ERROR,
                error_message=f"Frequency domain analysis error: {exc}",
            )

    # ── B. Noise Residuals ─────────────────────────────────────────────

    def analyze_noise_residuals(
        self,
        rgb_image: np.ndarray,
        evidence_id: str,
    ) -> NoiseResidualResult:
        """
        Extract high-pass residual and median filter denoising residual.
        Compute statistical moments and save amplified visualization maps.
        """
        try:
            gray = cv2.cvtColor(rgb_image, cv2.COLOR_RGB2GRAY).astype(np.float32)

            # 1. High-Pass Residual (Gaussian blur difference)
            blurred = cv2.GaussianBlur(gray, (5, 5), sigmaX=1.5)
            hp_residual = gray - blurred
            hp_std = round(float(np.std(hp_residual)), 4)

            # Amplify and center at 128 for visualization
            hp_vis = np.clip(hp_residual * 5.0 + 128.0, 0, 255).astype(np.uint8)
            hp_filename = f"{evidence_id}_high_pass_residual.png"
            hp_path = self.diagnostics_dir / hp_filename
            cv2.imwrite(str(hp_path), hp_vis)
            rel_hp_path = f"diagnostics/{hp_filename}"

            hp_details = HighPassResidualDetails(
                residual_map_path=rel_hp_path,
                residual_std=hp_std,
            )

            # 2. Denoising Residual (Median Filter: I - Median(I, k=3))
            uint8_gray = np.clip(gray, 0, 255).astype(np.uint8)
            denoised = cv2.medianBlur(uint8_gray, 3).astype(np.float32)
            denoise_residual = gray - denoised

            res_mean = round(float(np.mean(denoise_residual)), 4)
            res_std = round(float(np.std(denoise_residual)), 4)
            res_skew = round(float(scipy.stats.skew(denoise_residual.ravel())), 4)
            res_kurt = round(float(scipy.stats.kurtosis(denoise_residual.ravel())), 4)

            # Amplify and center at 128 for visualization
            denoise_vis = np.clip(denoise_residual * 8.0 + 128.0, 0, 255).astype(np.uint8)
            denoise_filename = f"{evidence_id}_denoising_residual.png"
            denoise_path = self.diagnostics_dir / denoise_filename
            cv2.imwrite(str(denoise_path), denoise_vis)
            rel_denoise_path = f"diagnostics/{denoise_filename}"

            denoise_details = DenoisingResidualDetails(
                residual_map_path=rel_denoise_path,
                residual_mean=res_mean,
                residual_std=res_std,
                residual_skewness=res_skew,
                residual_kurtosis=res_kurt,
            )

            return NoiseResidualResult(
                status=AnalysisExecutionStatus.SUCCESS,
                high_pass_residual=hp_details,
                denoising_residual=denoise_details,
            )

        except Exception as exc:
            logger.error("Noise residual analysis failed", error=str(exc))
            return NoiseResidualResult(
                status=AnalysisExecutionStatus.ERROR,
                error_message=f"Noise residual analysis error: {exc}",
            )

    # ── C. Compression and Resampling ──────────────────────────────────

    def analyze_compression_and_resampling(
        self,
        rgb_image: np.ndarray,
        detected_format: str,
        evidence_id: str,
    ) -> CompressionResamplingResult:
        """
        Analyze JPEG blockiness and ELA for JPEG uploads, and Gallagher-Chen
        periodic second-difference resampling indicators for all images.
        Safeguards non-JPEG images (PNG/WebP) against invalid JPEG assumptions.
        """
        is_jpeg = detected_format.upper() in ("JPEG", "JPG")
        fmt_upper = detected_format.upper()

        try:
            # 1. Resampling Indicators (Gallagher-Chen Periodic Second Differences)
            gray = cv2.cvtColor(rgb_image, cv2.COLOR_RGB2GRAY).astype(np.float32)
            h, w = gray.shape

            # Compute second differences along rows: D2_x = I[x+1] - 2*I[x] + I[x-1]
            # Resampling with linear/cubic kernel introduces periodic peaks in second differences
            d2_row = gray[:, 2:] - 2 * gray[:, 1:-1] + gray[:, :-2]
            d2_col = gray[2:, :] - 2 * gray[1:-1, :] + gray[:-2, :]

            # 1D FFT across rows and average power spectrum
            fft_rows = np.fft.fft(d2_row, axis=1)
            mag_rows = np.mean(np.abs(fft_rows), axis=0)

            # Ignore DC component (index 0) and evaluate peak-to-average ratio in AC
            if len(mag_rows) > 10:
                ac_mags = mag_rows[1 : len(mag_rows) // 2]
                mean_ac = np.mean(ac_mags) + 1e-6
                max_ac = np.max(ac_mags)
                peak_score = round(float(max_ac / mean_ac), 2)
            else:
                peak_score = 1.0

            resampling_details = ResamplingIndicatorDetails(
                status=AnalysisExecutionStatus.SUCCESS,
                periodic_peak_score=peak_score,
                notes=(
                    f"Periodic peak score is {peak_score}. Scores > 3.0 indicate potential periodic interpolation artifacts "
                    "consistent with geometric scaling or rotation."
                ),
            )

            # 2. Format-Specific Analysis: JPEG Blockiness and ELA
            if is_jpeg:
                # A. 8x8 Blockiness Metric (Fan & de Queiroz)
                h8, w8 = (h // 8) * 8, (w // 8) * 8
                if h8 >= 16 and w8 >= 16:
                    crop8 = gray[:h8, :w8]
                    # Boundary columns (8k-1 vs 8k)
                    boundary_col_diffs = []
                    internal_col_diffs = []
                    for c in range(8, w8, 8):
                        boundary_col_diffs.append(np.mean(np.abs(crop8[:, c] - crop8[:, c - 1])))
                        if c + 1 < w8:
                            internal_col_diffs.append(np.mean(np.abs(crop8[:, c + 1] - crop8[:, c])))

                    mean_bound = np.mean(boundary_col_diffs) if boundary_col_diffs else 0.0
                    mean_intern = np.mean(internal_col_diffs) if internal_col_diffs else 1.0
                    blockiness_val = round(float(mean_bound / (mean_intern + 1e-6)), 4)
                else:
                    blockiness_val = 1.0

                blockiness_details = JPEGBlockinessDetails(
                    status=AnalysisExecutionStatus.SUCCESS,
                    blockiness_metric=blockiness_val,
                    notes=(
                        f"Boundary discontinuity ratio: {blockiness_val}. Values > 1.0 indicate detectable 8x8 DCT grid "
                        "blockiness matching standard JPEG compression grids."
                    ),
                )

                # B. Error Level Analysis (ELA)
                pil_img = Image.fromarray(rgb_image)
                ela_buf = io.BytesIO()
                quality = self.settings.ela_jpeg_quality
                scale = self.settings.ela_scale_factor

                pil_img.save(ela_buf, format="JPEG", quality=quality)
                ela_buf.seek(0)
                recompressed_img = Image.open(ela_buf).convert("RGB")
                recomp_arr = np.array(recompressed_img, dtype=np.float32)

                diff = np.abs(rgb_image.astype(np.float32) - recomp_arr)
                mean_err = round(float(np.mean(diff)), 4)
                max_err = round(float(np.max(diff)), 4)

                # Amplified ELA visualization
                ela_vis = np.clip(diff * scale, 0, 255).astype(np.uint8)
                ela_filename = f"{evidence_id}_ela_quality_{quality}.png"
                ela_path = self.diagnostics_dir / ela_filename
                cv2.imwrite(str(ela_path), cv2.cvtColor(ela_vis, cv2.COLOR_RGB2BGR))
                rel_ela_path = f"diagnostics/{ela_filename}"

                ela_details = ELADetails(
                    status=AnalysisExecutionStatus.SUCCESS,
                    recompression_quality=quality,
                    scale_factor=scale,
                    mean_error=mean_err,
                    max_error=max_err,
                    ela_map_path=rel_ela_path,
                    notes=(
                        f"ELA computed at JPEG quality {quality} with {scale}x visual amplification. "
                        "Uniform error levels suggest consistent single-pass compression; localized error hot-spots "
                        "warrant closer spatial inspection."
                    ),
                )
            else:
                # Safe fallback for PNG / WebP: do not apply JPEG assumptions
                blockiness_details = JPEGBlockinessDetails(
                    status=AnalysisExecutionStatus.NOT_APPLICABLE,
                    blockiness_metric=None,
                    notes=f"Not applicable to {fmt_upper} format. 8x8 blockiness diagnostics require standard JPEG DCT grid encoding.",
                )
                ela_details = ELADetails(
                    status=AnalysisExecutionStatus.NOT_APPLICABLE,
                    recompression_quality=self.settings.ela_jpeg_quality,
                    scale_factor=self.settings.ela_scale_factor,
                    mean_error=None,
                    max_error=None,
                    ela_map_path=None,
                    notes=(
                        f"ELA is not applicable to lossless {fmt_upper} uploads. Recompressing a non-JPEG image into JPEG "
                        "would synthesize artificial compression artifacts not present in the original evidence."
                    ),
                )

            return CompressionResamplingResult(
                status=AnalysisExecutionStatus.SUCCESS,
                is_jpeg=is_jpeg,
                detected_format=fmt_upper,
                jpeg_blockiness=blockiness_details,
                ela=ela_details,
                resampling_indicators=resampling_details,
                format_applicability_note=(
                    "Diagnostic compliance verified: JPEG-specific transforms (8x8 blockiness, ELA) are restricted to JPEG uploads. "
                    "Lossless or non-DCT formats are safely isolated."
                ),
            )

        except Exception as exc:
            logger.error("Compression and resampling analysis failed", error=str(exc))
            return CompressionResamplingResult(
                status=AnalysisExecutionStatus.ERROR,
                is_jpeg=is_jpeg,
                detected_format=fmt_upper,
                format_applicability_note="Error encountered during compression/resampling evaluation",
                error_message=f"Compression analysis error: {exc}",
            )

    # ── D. Spatial Analysis ────────────────────────────────────────────

    def analyze_spatial_boundary(
        self,
        rgb_image: np.ndarray,
        detected_faces: List[DetectedFace],
        evidence_id: str,
    ) -> SpatialAnalysisResult:
        """
        Analyze face boundary margin, local texture sharpness (Laplacian variance),
        and color transition delta E across face seams.
        """
        try:
            if not detected_faces:
                details = FaceBoundarySpatialDetails(
                    face_detected=False,
                    limitations="No face detected in evidence image. Face boundary spatial analysis not applicable.",
                )
                return SpatialAnalysisResult(
                    status=AnalysisExecutionStatus.NOT_APPLICABLE,
                    face_boundary=details,
                )

            # Analyze the primary (first/highest confidence) detected face
            face = detected_faces[0]
            bbox = face.bounding_box
            img_h, img_w, _ = rgb_image.shape

            x, y, w, h = bbox.origin_x, bbox.origin_y, bbox.width, bbox.height

            # Constrain to image bounds
            x0 = max(0, x)
            y0 = max(0, y)
            x1 = min(img_w, x + w)
            y1 = min(img_h, y + h)

            if (x1 - x0) < 16 or (y1 - y0) < 16:
                details = FaceBoundarySpatialDetails(
                    face_detected=True,
                    limitations="Face bounding box is too small for reliable boundary texture decomposition.",
                )
                return SpatialAnalysisResult(
                    status=AnalysisExecutionStatus.NOT_APPLICABLE,
                    face_boundary=details,
                )

            gray = cv2.cvtColor(rgb_image, cv2.COLOR_RGB2GRAY)
            lab = cv2.cvtColor(rgb_image, cv2.COLOR_RGB2LAB).astype(np.float32)

            # 1. Inner face core (70% central area)
            core_margin_x = int(0.15 * (x1 - x0))
            core_margin_y = int(0.15 * (y1 - y0))
            inner_core = gray[y0 + core_margin_y : y1 - core_margin_y, x0 + core_margin_x : x1 - core_margin_x]
            inner_var = round(float(cv2.Laplacian(inner_core, cv2.CV_64F).var()), 2) if inner_core.size > 0 else 0.0

            # 2. Boundary margin ring (band +/- 10% around boundary)
            band_pad_x = max(2, int(0.10 * (x1 - x0)))
            band_pad_y = max(2, int(0.10 * (y1 - y0)))

            bx0 = max(0, x0 - band_pad_x)
            by0 = max(0, y0 - band_pad_y)
            bx1 = min(img_w, x1 + band_pad_x)
            by1 = min(img_h, y1 + band_pad_y)

            # Mask for boundary ring: pixels in expanded box that are outside the contracted core
            boundary_mask = np.zeros((img_h, img_w), dtype=bool)
            boundary_mask[by0:by1, bx0:bx1] = True
            boundary_mask[y0 + core_margin_y : y1 - core_margin_y, x0 + core_margin_x : x1 - core_margin_x] = False

            boundary_pixels = gray[boundary_mask]
            # Compute Laplacian of the bounding region
            lap_full = cv2.Laplacian(gray, cv2.CV_64F)
            boundary_var = round(float(np.var(lap_full[boundary_mask])), 2) if np.any(boundary_mask) else 0.0

            # 3. Outer background ring (expanded region 1.1x to 1.3x)
            out_pad_x = int(0.30 * (x1 - x0))
            out_pad_y = int(0.30 * (y1 - y0))
            ox0 = max(0, x0 - out_pad_x)
            oy0 = max(0, y0 - out_pad_y)
            ox1 = min(img_w, x1 + out_pad_x)
            oy1 = min(img_h, y1 + out_pad_y)

            outer_mask = np.zeros((img_h, img_w), dtype=bool)
            outer_mask[oy0:oy1, ox0:ox1] = True
            outer_mask[by0:by1, bx0:bx1] = False

            outer_var = round(float(np.var(lap_full[outer_mask])), 2) if np.any(outer_mask) else 0.0

            # Discontinuity ratio
            texture_ratio = round(float(boundary_var / (inner_var + 1e-6)), 4)

            # 4. Color Transition Seam: CIE Delta E across inner and outer margin
            inner_lab = lab[y0 + core_margin_y : y1 - core_margin_y, x0 + core_margin_x : x1 - core_margin_x]
            outer_lab = lab[outer_mask]
            if inner_lab.size > 0 and outer_lab.size > 0:
                mean_inner_lab = np.mean(inner_lab, axis=(0, 1))
                mean_outer_lab = np.mean(outer_lab, axis=0)
                delta_e = round(float(np.sqrt(np.sum((mean_inner_lab - mean_outer_lab) ** 2))), 2)
            else:
                delta_e = 0.0

            # 5. Diagnostic Visualization: Draw annotated bands on copy
            annotated = rgb_image.copy()
            # Draw outer ring in blue, boundary in yellow, inner core in green
            cv2.rectangle(annotated, (ox0, oy0), (ox1, oy1), (0, 120, 255), 2)  # Blue/Orange outer
            cv2.rectangle(annotated, (bx0, by0), (bx1, by1), (255, 200, 0), 2)  # Yellow boundary band
            cv2.rectangle(annotated, (x0 + core_margin_x, y0 + core_margin_y), (x1 - core_margin_x, y1 - core_margin_y), (0, 255, 100), 2)  # Green inner core

            annotated_filename = f"{evidence_id}_face_boundary_analysis.png"
            annotated_path = self.diagnostics_dir / annotated_filename
            cv2.imwrite(str(annotated_path), cv2.cvtColor(annotated, cv2.COLOR_RGB2BGR))
            rel_annotated_path = f"diagnostics/{annotated_filename}"

            details = FaceBoundarySpatialDetails(
                face_detected=True,
                inner_face_laplacian_var=inner_var,
                boundary_ring_laplacian_var=boundary_var,
                outer_background_laplacian_var=outer_var,
                texture_discontinuity_ratio=texture_ratio,
                color_seam_delta_e=delta_e,
                boundary_visualization_path=rel_annotated_path,
            )

            return SpatialAnalysisResult(
                status=AnalysisExecutionStatus.SUCCESS,
                face_boundary=details,
            )

        except Exception as exc:
            logger.error("Spatial analysis failed", error=str(exc))
            return SpatialAnalysisResult(
                status=AnalysisExecutionStatus.ERROR,
                error_message=f"Spatial analysis error: {exc}",
            )

    # ── E & F. Pretrained Models & PRNU Disclosures ────────────────────

    def get_optional_models_disclosure(self) -> Dict[str, PretrainedForensicModelDisclosure]:
        """
        Return structured license and status disclosures for FSD and TruFor.
        Both models remain disabled by default until usage terms have been reviewed.
        """
        fsd_status = (
            AnalysisExecutionStatus.SUCCESS
            if self.settings.enable_fsd
            else AnalysisExecutionStatus.DISABLED_BY_DEFAULT
        )
        trufor_status = (
            AnalysisExecutionStatus.SUCCESS
            if self.settings.enable_trufor
            else AnalysisExecutionStatus.DISABLED_BY_DEFAULT
        )

        return {
            "fsd": PretrainedForensicModelDisclosure(
                model_name="FSD (Forensic Self-Descriptions)",
                paper_reference="Forensic Self-Descriptions Are All You Need for Zero-Shot Detection, Open-Set Source Attribution, and Clustering of AI-generated Images (CVPR 2025)",
                official_repo="https://github.com/ductai199x/Forensic-Self-Descriptions-CVPR25",
                license="CC BY-NC-SA 4.0 (Creative Commons NonCommercial ShareAlike 4.0)",
                license_review_status="PENDING_LEGAL_TERMS_REVIEW",
                is_enabled=self.settings.enable_fsd,
                status=fsd_status,
                guidance=(
                    "Under CC BY-NC-SA 4.0, commercial exploitation is strictly prohibited without a commercial license. "
                    "ShieldHer keeps FSD disabled by default until deployment terms are formally approved."
                ),
            ),
            "trufor": PretrainedForensicModelDisclosure(
                model_name="TruFor (Trustworthy Image Forgery Detection & Localization)",
                paper_reference="TruFor: Leveraging all-round clues for trustworthy image forgery detection and localization (CVPR 2023)",
                official_repo="https://github.com/grip-unina/TruFor",
                license="Custom Academic Non-Profit License (GRIP-UNINA)",
                license_review_status="PENDING_LEGAL_TERMS_REVIEW",
                is_enabled=self.settings.enable_trufor,
                status=trufor_status,
                guidance=(
                    "GRIP-UNINA license restricts software and weights to informational and non-profit usage. "
                    "Commercial or production deployment requires author permission. Kept disabled by default."
                ),
            ),
        }

    def get_prnu_disclosure(self) -> PRNUSensorAttributionDisclosure:
        """
        Return strict PRNU scientific methodology disclosure.
        """
        return PRNUSensorAttributionDisclosure()

    # ── Master Forensic Pipeline ──────────────────────────────────────

    def generate_forensic_report(
        self,
        rgb_image: np.ndarray,
        evidence_id: str,
        detected_format: str,
        detected_faces: Optional[List[DetectedFace]] = None,
        sha256: Optional[str] = None,
    ) -> ForensicReport:
        """
        Execute full deterministic forensic analysis suite.
        """
        faces = detected_faces or []

        freq_result = self.analyze_frequency_domain(rgb_image, evidence_id)
        noise_result = self.analyze_noise_residuals(rgb_image, evidence_id)
        comp_result = self.analyze_compression_and_resampling(rgb_image, detected_format, evidence_id)
        spatial_result = self.analyze_spatial_boundary(rgb_image, faces, evidence_id)
        optional_models = self.get_optional_models_disclosure()
        prnu_note = self.get_prnu_disclosure()

        # Overall execution status
        statuses = [freq_result.status, noise_result.status, comp_result.status, spatial_result.status]
        if all(s == AnalysisExecutionStatus.SUCCESS for s in statuses):
            overall_status = AnalysisExecutionStatus.SUCCESS
        elif any(s == AnalysisExecutionStatus.SUCCESS for s in statuses):
            overall_status = AnalysisExecutionStatus.SUCCESS
        else:
            overall_status = AnalysisExecutionStatus.ERROR

        return ForensicReport(
            evidence_id=evidence_id,
            status=overall_status,
            sha256=sha256,
            frequency=freq_result,
            noise_residuals=noise_result,
            compression_resampling=comp_result,
            spatial=spatial_result,
            optional_models=optional_models,
            prnu=prnu_note,
        )


_forensic_service_instance: Optional[ForensicAnalysisService] = None


def get_forensic_service() -> ForensicAnalysisService:
    global _forensic_service_instance
    if _forensic_service_instance is None:
        _forensic_service_instance = ForensicAnalysisService()
    return _forensic_service_instance
