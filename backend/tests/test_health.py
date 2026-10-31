"""
Tests for the /health endpoints.

External dependencies (Postgres, Redis) are mocked so these tests
run without any infrastructure.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient


@pytest.fixture(scope="module")
def app():
    from app.main import create_app
    return create_app()


@pytest.fixture
async def client(app):
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://testserver",
    ) as ac:
        yield ac


# ── /health/live ──────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_liveness(client):
    response = await client.get("/health/live")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


# ── /health – all deps healthy ────────────────────────────────────────────
@pytest.mark.asyncio
async def test_health_all_ok(client):
    from app.api.health import DependencyStatus

    ok_status = DependencyStatus(status="ok", latency_ms=1.0)

    with (
        patch(
            "app.api.health._check_postgres",
            new_callable=AsyncMock,
            return_value=ok_status,
        ),
        patch(
            "app.api.health._check_redis",
            new_callable=AsyncMock,
            return_value=ok_status,
        ),
    ):
        response = await client.get("/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert "postgres" in body["checks"]
    assert "redis" in body["checks"]


# ── /health – dependency failure ──────────────────────────────────────────
@pytest.mark.asyncio
async def test_health_degraded(client):
    """When a dependency is down the overall status must be 'error'."""
    from app.api.health import DependencyStatus

    ok = DependencyStatus(status="ok", latency_ms=1.0)
    err = DependencyStatus(status="error", detail="connection refused")

    with (
        patch("app.api.health._check_postgres", new_callable=AsyncMock, return_value=ok),
        patch("app.api.health._check_redis", new_callable=AsyncMock, return_value=err),
    ):
        response = await client.get("/health")

    assert response.status_code == 503
    body = response.json()
    assert body["status"] == "error"
    assert body["checks"]["redis"]["status"] == "error"
