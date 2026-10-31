"""
Tests for the global exception handlers.
"""
from __future__ import annotations

import pytest
from fastapi import FastAPI, HTTPException
from httpx import ASGITransport, AsyncClient

from app.exceptions import register_exception_handlers


def _make_test_app() -> FastAPI:
    """Minimal app that triggers each error type."""
    app = FastAPI()
    register_exception_handlers(app)

    @app.get("/trigger-http")
    async def trigger_http():
        raise HTTPException(status_code=404, detail="not found")

    @app.get("/trigger-500")
    async def trigger_500():
        raise RuntimeError("boom")

    return app


@pytest.fixture
async def err_client():
    app = _make_test_app()
    async with AsyncClient(
        transport=ASGITransport(app=app, raise_app_exceptions=False),
        base_url="http://testserver",
    ) as ac:
        yield ac


@pytest.mark.asyncio
async def test_http_exception_returns_json(err_client):
    response = await err_client.get("/trigger-http")
    assert response.status_code == 404
    body = response.json()
    assert "error" in body
    assert body["error"]["status"] == 404


@pytest.mark.asyncio
async def test_unhandled_exception_returns_500(err_client):
    response = await err_client.get("/trigger-500")
    assert response.status_code == 500
    body = response.json()
    assert "error" in body
    assert body["error"]["status"] == 500
    assert "error_id" in body["error"]
