#!/usr/bin/env python3
"""
ShieldHer – Multi-Model Evaluation Harness.

Evaluates all four pretrained detection models on benchmark inputs:
- Category A (Face Manipulation):
  1. Effort-AIGI-Detection (FaceForensics++ CLIP-L/14 with SVD Residuals, ICML 2025)
  2. GenD Deepfake Detector (CLIP-L/14 LinearNorm, WACV 2026)
- Category B (Full-Image AI Generation):
  3. Smaug AI Image Detector (EmbeddingGemma-2, Abacus.AI)
  4. Forensic Self-Descriptions / FSD (FRE Residuals + GMM, CVPR 2025)

Computes latency, output scores, category agreement, and hardware stats.
"""
from __future__ import annotations

import argparse
import io
import json
import os
import sys
import time
from pathlib import Path
from typing import Any, Dict, Optional

import numpy as np
from PIL import Image

# Ensure backend root is on sys.path
SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.config import get_settings
from app.schemas.verification import ModelInferenceStatus
from app.services.effort_adapter import get_effort_adapter
from app.services.fsd_adapter import get_fsd_adapter
from app.services.gend_adapter import get_gend_adapter
from app.services.smaug_adapter import get_smaug_adapter
from app.services.model_registry_service import (
    evaluate_face_manipulation_agreement,
    evaluate_ai_generation_agreement,
)


def create_synthetic_face_image() -> Image.Image:
    """Generate a clean synthetic portrait-style image for evaluation."""
    arr = np.full((384, 384, 3), 140, dtype=np.uint8)
    # Add subtle gradients and features
    for y in range(0, 384, 16):
        arr[y : y + 8, :, :] = np.clip(140 + 40, 0, 255)
    for x in range(0, 384, 16):
        arr[:, x : x + 8, :] = np.clip(140 - 40, 0, 255)
    return Image.fromarray(arr, mode="RGB")


def evaluate_image(
    image_path: Optional[str] = None,
    output_json: Optional[str] = None,
    verbose: bool = True,
) -> Dict[str, Any]:
    """Execute all 4 detectors sequentially on the provided image."""
    settings = get_settings()

    if image_path and Path(image_path).exists():
        pil_image = Image.open(image_path).convert("RGB")
        source_name = Path(image_path).name
    else:
        pil_image = create_synthetic_face_image()
        source_name = "synthetic_evaluation_sample.png"

    image_np = np.array(pil_image)
    width, height = pil_image.size

    if verbose:
        print("=" * 72)
        print(" SHIELDHER — FOUR-MODEL EVALUATION HARNESS")
        print("=" * 72)
        print(f"Target Image:      {source_name} ({width}x{height})")
        print(f"Hardware Platform: PyTorch on {settings.ml_device}")
        print("-" * 72)

    results: Dict[str, Any] = {
        "image": source_name,
        "dimensions": [width, height],
        "models": {},
        "agreements": {},
    }

    # ── Model 1: EFFORT ─────────────────────────────────────────────────────
    if verbose:
        print("\n[1/4] Running EFFORT (Face Manipulation ViT-L/14)...")
    import gc
    from app.services import effort_adapter as ea_mod
    effort_adapter = get_effort_adapter()
    t0 = time.perf_counter()
    effort_res = effort_adapter.predict(image_np)
    effort_dur = (time.perf_counter() - t0) * 1000

    results["models"]["effort"] = {
        "status": effort_res.status.value,
        "manipulation_score": effort_res.manipulation_score,
        "predicted_label": effort_res.predicted_label.value if effort_res.predicted_label else None,
        "raw_logits": effort_res.raw_logits,
        "latency_ms": round(effort_dur, 2),
    }
    if verbose:
        print(f"      Status:     {effort_res.status.value}")
        print(f"      Score:      {effort_res.manipulation_score}")
        print(f"      Latency:    {effort_dur:.1f} ms")

    # Release EFFORT from RAM
    effort_adapter._model = None
    del effort_adapter
    ea_mod._effort_adapter_service = None
    gc.collect()

    # ── Model 2: GenD ───────────────────────────────────────────────────────
    if verbose:
        print("\n[2/4] Running GenD (Face Deepfake ViT-L/14 LinearNorm)...")
    from app.services import gend_adapter as ga_mod
    gend_adapter = get_gend_adapter()
    t0 = time.perf_counter()
    gend_res = gend_adapter.predict(pil_image)
    gend_dur = (time.perf_counter() - t0) * 1000

    results["models"]["gend"] = {
        "status": gend_res.status.value,
        "predicted_class": gend_res.predicted_class,
        "class_scores": gend_res.class_scores,
        "raw_logits": gend_res.raw_logits,
        "latency_ms": round(gend_dur, 2),
    }
    if verbose:
        print(f"      Status:     {gend_res.status.value}")
        print(f"      Prediction: {gend_res.predicted_class}")
        print(f"      Scores:     {gend_res.class_scores}")
        print(f"      Latency:    {gend_dur:.1f} ms")

    # Release GenD from RAM
    gend_adapter._model = None
    del gend_adapter
    ga_mod._gend_adapter_service = None
    gc.collect()

    # ── Model 3: Smaug ──────────────────────────────────────────────────────
    if verbose:
        print("\n[3/4] Running Smaug (Full-Image AI Generation EmbeddingGemma-2)...")
    from app.services import smaug_adapter as sa_mod
    smaug_adapter = get_smaug_adapter()
    t0 = time.perf_counter()
    smaug_res = smaug_adapter.predict(pil_image)
    smaug_dur = (time.perf_counter() - t0) * 1000

    results["models"]["smaug"] = {
        "status": smaug_res.status.value,
        "ai_generation_score": smaug_res.ai_generation_score,
        "predicted_label": smaug_res.predicted_label.value if smaug_res.predicted_label else None,
        "crops_evaluated": smaug_res.crops_evaluated,
        "latency_ms": round(smaug_dur, 2),
    }
    if verbose:
        print(f"      Status:     {smaug_res.status.value}")
        print(f"      AI Score:   {smaug_res.ai_generation_score}")
        print(f"      Crops:      {smaug_res.crops_evaluated}")
        print(f"      Latency:    {smaug_dur:.1f} ms")

    # Release Smaug from RAM
    smaug_adapter._model = None
    del smaug_adapter
    sa_mod._smaug_adapter_service = None
    gc.collect()

    # ── Model 4: FSD ────────────────────────────────────────────────────────
    if verbose:
        print("\n[4/4] Running FSD (Forensic Residual FRE + GMM)...")
    from app.services import fsd_adapter as fa_mod
    fsd_adapter = get_fsd_adapter()
    t0 = time.perf_counter()
    fsd_res = fsd_adapter.predict(pil_image)
    fsd_dur = (time.perf_counter() - t0) * 1000

    results["models"]["fsd"] = {
        "status": fsd_res.status.value,
        "native_z_score": fsd_res.native_z_score,
        "model_derived_decision": fsd_res.model_derived_decision,
        "latency_ms": round(fsd_dur, 2),
    }
    if verbose:
        print(f"      Status:     {fsd_res.status.value}")
        print(f"      Z-Score:    {fsd_res.native_z_score}")
        print(f"      Decision:   {fsd_res.model_derived_decision}")
        print(f"      Latency:    {fsd_dur:.1f} ms")

    # Release FSD from RAM
    fsd_adapter._detector = None
    del fsd_adapter
    fa_mod._fsd_adapter_service = None
    gc.collect()

    # ── Category Agreement Synthesis ────────────────────────────────────────
    face_agreement = evaluate_face_manipulation_agreement(effort_res, gend_res)
    ai_agreement = evaluate_ai_generation_agreement(smaug_res, fsd_res)

    results["agreements"]["face_manipulation"] = face_agreement.model_dump()
    results["agreements"]["ai_generation"] = ai_agreement.model_dump()

    if verbose:
        print("\n" + "=" * 72)
        print(" CATEGORY AGREEMENT SYNTHESIS")
        print("=" * 72)
        print("Category A: Face Manipulation (EFFORT + GenD)")
        print(f"  Status:  {face_agreement.status.value}")
        print(f"  Summary: {face_agreement.summary}")
        print(f"  Details: {face_agreement.details}")
        print()
        print("Category B: AI-Generated Image (Smaug + FSD)")
        print(f"  Status:  {ai_agreement.status.value}")
        print(f"  Summary: {ai_agreement.summary}")
        print(f"  Details: {ai_agreement.details}")
        print("=" * 72)

    if output_json:
        out_p = Path(output_json)
        out_p.parent.mkdir(parents=True, exist_ok=True)
        with open(out_p, "w", encoding="utf-8") as f:
            json.dump(results, f, indent=2)
        if verbose:
            print(f"Saved evaluation report to {output_json}")

    return results


def main():
    parser = argparse.ArgumentParser(description="ShieldHer Multi-Model Evaluation Harness")
    parser.add_argument("--image", type=str, default=None, help="Path to test image file")
    parser.add_argument("--output", type=str, default=None, help="Path to write JSON evaluation output")
    args = parser.parse_args()

    evaluate_image(image_path=args.image, output_json=args.output, verbose=True)


if __name__ == "__main__":
    main()
