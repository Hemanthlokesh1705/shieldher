"""
ShieldHer – /health endpoint.

Returns the status of the application and its upstream dependencies
(PostgreSQL and Redis).  Designed to be used as a Docker/k8s health check.

Response codes:
  200 – all checks passed
  503 – one or more checks failed (service unavailable)
"""
from __future__ import annotations

import time
from typing import Literal

from fastapi import APIRouter, Response, status
from pydantic import BaseModel

from app.logging_config import get_logger

router = APIRouter(tags=["health"])
logger = get_logger(__name__)

# ── Response schemas ──────────────────────────────────────────────────────
CheckStatus = Literal["ok", "error"]


class DependencyStatus(BaseModel):
    status: CheckStatus
    latency_ms: float | None = None
    detail: str | None = None


class HealthResponse(BaseModel):
    status: CheckStatus
    version: str
    environment: str
    checks: dict[str, DependencyStatus]


# ── Helpers ───────────────────────────────────────────────────────────────
async def _check_postgres() -> DependencyStatus:
    try:
        from app.database import get_engine
        from sqlalchemy import text

        start = time.perf_counter()
        engine = get_engine()
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        latency = (time.perf_counter() - start) * 1000
        return DependencyStatus(status="ok", latency_ms=round(latency, 2))
    except Exception as exc:  # pragma: no cover
        logger.warning("Postgres health check failed", error=str(exc))
        return DependencyStatus(status="error", detail=str(exc))


async def _check_redis() -> DependencyStatus:
    try:
        from app.redis_client import get_redis

        start = time.perf_counter()
        redis = get_redis()
        await redis.ping()
        latency = (time.perf_counter() - start) * 1000
        return DependencyStatus(status="ok", latency_ms=round(latency, 2))
    except Exception as exc:  # pragma: no cover
        logger.warning("Redis health check failed", error=str(exc))
        return DependencyStatus(status="error", detail=str(exc))


# ── Endpoint ──────────────────────────────────────────────────────────────
@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Application health check",
    description=(
        "Returns HTTP 200 when the application and all dependencies are healthy, "
        "HTTP 503 when any check fails."
    ),
)
async def health_check(response: Response) -> HealthResponse:
    from app.config import get_settings

    settings = get_settings()

    pg_status = await _check_postgres()
    redis_status = await _check_redis()

    all_ok = pg_status.status == "ok" and redis_status.status == "ok"
    overall: CheckStatus = "ok" if all_ok else "error"

    health_resp = HealthResponse(
        status=overall,
        version="0.1.0",
        environment=settings.app_env,
        checks={
            "postgres": pg_status,
            "redis": redis_status,
        },
    )

    # Return 503 so load-balancers / Docker healthchecks mark it unhealthy
    if not all_ok:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        logger.warning("Health check degraded", checks=health_resp.model_dump())

    return health_resp


@router.get(
    "/health/live",
    summary="Liveness probe (no dependency checks)",
    description="Lightweight liveness check – just confirms the process is running.",
)
async def liveness() -> dict:
    return {"status": "ok"}
