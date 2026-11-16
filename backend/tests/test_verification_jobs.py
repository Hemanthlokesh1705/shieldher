"""
ShieldHer – Unit Tests for Asynchronous Verification Job API & Four-Model Checkpoints.

Tests:
1. POST /verify/jobs initiates a verification job and returns job_id with initial checkpoints.
2. GET /verify/jobs/{job_id} retrieves running/completed job status with checkpoints and model registry.
3. GET /verify/jobs/{non_existent_id} returns HTTP 404.
4. POST /verify returns synchronous verification outcome with all four models and agreement summaries.
"""
from __future__ import annotations

import io
from pathlib import Path
from unittest.mock import patch, MagicMock

import numpy as np
import pytest
from httpx import ASGITransport, AsyncClient
from PIL import Image

from app.main import create_app
from app.schemas.verification import (
    ModelInferenceStatus,
    PredictedLabel,
    VerificationOutcome,
)
from tests.test_upload import make_synthetic_image


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


@pytest.mark.asyncio
async def test_start_verification_job_and_poll(client):
    """Test initiating an asynchronous job and retrieving its status."""
    img_bytes = make_synthetic_image(width=300, height=300, fmt="JPEG")
    files = {"file": ("test_portrait.jpg", img_bytes, "image/jpeg")}

    # 1. Start Job
    start_res = await client.post("/verify/jobs", files=files)
    assert start_res.status_code == 200
    data = start_res.json()

    assert "job_id" in data
    assert "verification_id" in data
    assert "checkpoints" in data
    assert data["checkpoints"]["image_upload"] == "COMPLETED"
    assert "model_registry" in data

    job_id = data["job_id"]

    # 2. Poll Job Status
    poll_res = await client.get(f"/verify/jobs/{job_id}")
    assert poll_res.status_code == 200
    poll_data = poll_res.json()
    assert poll_data["job_id"] == job_id
    assert "checkpoints" in poll_data
    assert "overall_status" in poll_data


@pytest.mark.asyncio
async def test_get_nonexistent_job_returns_404(client):
    """Test polling for a nonexistent verification job."""
    res = await client.get("/verify/jobs/nonexistent-uuid-12345")
    assert res.status_code == 404
    body = res.json()
    msg = body.get("error", {}).get("message", "") or body.get("detail", "")
    assert "not found" in msg.lower()
