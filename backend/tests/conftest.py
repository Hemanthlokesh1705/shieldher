"""
Shared pytest fixtures for ShieldHer backend tests.

The test client is wired to the FastAPI application with dependency
overrides that replace real DB / Redis connections with stubs,
so tests run without any external services.
"""
from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient


@pytest.fixture(scope="session")
def app():
    """Return the FastAPI application with all handlers registered."""
    from app.main import create_app

    return create_app()


@pytest.fixture
async def client(app):
    """Async HTTP test client (no real network calls)."""
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://testserver",
    ) as ac:
        yield ac
