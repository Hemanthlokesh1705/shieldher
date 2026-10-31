"""
ShieldHer – Local Perceptual and Cryptographic Comparison Service.

Computes:
1. Exact SHA-256 cryptographic digests (verifies byte-level identity).
2. 64-bit DCT-based Perceptual Hash (pHash).
3. 64-bit Average Hash (aHash) & Difference Hash (dHash).
4. Bitwise Hamming distances and normalized similarity metrics.

CRITICAL PRINCIPLE:
Perceptual hash matches indicate mathematical visual resemblance under minor
resizing or compression. They DO NOT establish common camera sensor origin,
common authorship, or shared forensic provenance.
"""
from __future__ import annotations

import hashlib
import io
from typing import Dict, Tuple
import numpy as np
from PIL import Image
from scipy.fftpack import dct
import structlog

from app.schemas.reverse_search import LocalComparisonResult, LocalMatchCategory

logger = structlog.get_logger(__name__)


class LocalComparisonService:
    """Provides deterministic local hash and perceptual similarity comparisons."""

    @staticmethod
    def compute_sha256(data: bytes) -> str:
        """Compute standard SHA-256 hex digest."""
        return hashlib.sha256(data).hexdigest()

    @staticmethod
    def compute_phash(img: Image.Image) -> str:
        """
        Computes 64-bit Discrete Cosine Transform (DCT) perceptual hash (pHash).
        1. Convert to grayscale and resize to 32x32.
        2. Compute 2D DCT.
        3. Extract top-left 8x8 low-frequency coefficients.
        4. Threshold against the median of the coefficients to generate 64 bits.
        5. Return 16-character hexadecimal string.
        """
        gray = img.convert("L").resize((32, 32), Image.Resampling.BILINEAR)
        pixels = np.array(gray, dtype=float)
        # 2D DCT
        dct_block = dct(dct(pixels, axis=0), axis=1)[:8, :8]
        median_val = float(np.median(dct_block))
        diff = dct_block > median_val
        bit_str = "".join(["1" if b else "0" for b in diff.flatten()])
        return format(int(bit_str, 2), "016x")

    @staticmethod
    def compute_ahash(img: Image.Image) -> str:
        """Computes 64-bit Average Hash (aHash)."""
        gray = img.convert("L").resize((8, 8), Image.Resampling.BILINEAR)
        pixels = np.array(gray, dtype=float)
        avg = float(np.mean(pixels))
        diff = pixels > avg
        bit_str = "".join(["1" if b else "0" for b in diff.flatten()])
        return format(int(bit_str, 2), "016x")

    @staticmethod
    def compute_dhash(img: Image.Image) -> str:
        """Computes 64-bit Difference Hash (dHash) along horizontal gradients."""
        gray = img.convert("L").resize((9, 8), Image.Resampling.BILINEAR)
        pixels = np.array(gray, dtype=float)
        diff = pixels[:, :-1] > pixels[:, 1:]
        bit_str = "".join(["1" if b else "0" for b in diff.flatten()])
        return format(int(bit_str, 2), "016x")

    @classmethod
    def compute_all_hashes(cls, image_bytes: bytes) -> Dict[str, str]:
        """Compute SHA-256 and perceptual hashes for an image."""
        sha256 = cls.compute_sha256(image_bytes)
        with Image.open(io.BytesIO(image_bytes)) as pil_img:
            phash = cls.compute_phash(pil_img)
            ahash = cls.compute_ahash(pil_img)
            dhash = cls.compute_dhash(pil_img)
        return {
            "sha256": sha256,
            "phash": phash,
            "ahash": ahash,
            "dhash": dhash,
        }

    @staticmethod
    def hamming_distance(hex_hash1: str, hex_hash2: str) -> int:
        """Compute bitwise Hamming distance between two 16-hex (64-bit) hashes."""
        val1 = int(hex_hash1, 16)
        val2 = int(hex_hash2, 16)
        return bin(val1 ^ val2).count("1")

    @classmethod
    def compare_images(cls, query_bytes: bytes, reference_bytes: bytes) -> LocalComparisonResult:
        """
        Compares two image byte arrays locally:
        - Bitwise SHA-256 equality.
        - 64-bit pHash Hamming distance and normalized similarity score.
        - aHash and dHash auxiliary distances.
        """
        query_hashes = cls.compute_all_hashes(query_bytes)
        ref_hashes = cls.compute_all_hashes(reference_bytes)

        is_exact_sha256 = (query_hashes["sha256"] == ref_hashes["sha256"])
        phash_dist = cls.hamming_distance(query_hashes["phash"], ref_hashes["phash"])
        ahash_dist = cls.hamming_distance(query_hashes["ahash"], ref_hashes["ahash"])
        dhash_dist = cls.hamming_distance(query_hashes["dhash"], ref_hashes["dhash"])

        sim_score = max(0.0, min(1.0, (64 - phash_dist) / 64.0))

        # Categorize similarity
        if is_exact_sha256:
            category = LocalMatchCategory.EXACT_BYTE_MATCH
        elif phash_dist == 0:
            category = LocalMatchCategory.EXACT_PERCEPTUAL_MATCH
        elif phash_dist <= 6:
            category = LocalMatchCategory.HIGH_VISUAL_SIMILARITY
        elif phash_dist <= 12:
            category = LocalMatchCategory.MODERATE_VISUAL_SIMILARITY
        elif phash_dist <= 20:
            category = LocalMatchCategory.LOW_SIMILARITY
        else:
            category = LocalMatchCategory.NO_SIMILARITY

        return LocalComparisonResult(
            query_sha256=query_hashes["sha256"],
            reference_sha256=ref_hashes["sha256"],
            is_exact_sha256_match=is_exact_sha256,
            query_phash=query_hashes["phash"],
            reference_phash=ref_hashes["phash"],
            hamming_distance=phash_dist,
            visual_similarity_score=round(sim_score, 4),
            match_category=category,
            details={
                "ahash_distance": ahash_dist,
                "dhash_distance": dhash_dist,
                "query_ahash": query_hashes["ahash"],
                "reference_ahash": ref_hashes["ahash"],
                "query_dhash": query_hashes["dhash"],
                "reference_dhash": ref_hashes["dhash"],
            },
        )


_local_comparison_service: LocalComparisonService | None = None


def get_local_comparison_service() -> LocalComparisonService:
    global _local_comparison_service
    if _local_comparison_service is None:
        _local_comparison_service = LocalComparisonService()
    return _local_comparison_service
