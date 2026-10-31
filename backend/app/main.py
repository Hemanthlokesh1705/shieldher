"""
ShieldHer – FastAPI application factory.
"""
from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware

from app.config import get_settings
from app.exceptions import register_exception_handlers
from app.logging_config import configure_logging, get_logger

# ── Logging must be configured before anything else ───────────────────────
settings = get_settings()
configure_logging(
    log_level=settings.log_level,
    json_logs=settings.is_production,
)
logger = get_logger(__name__)


# ── Lifespan (startup / shutdown) ─────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    logger.info(
        "ShieldHer starting",
        environment=settings.app_env,
        version="0.1.0",
    )

    # Ensure upload directory and subdirectories exist
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    (settings.upload_dir / "originals").mkdir(parents=True, exist_ok=True)
    (settings.upload_dir / "derivatives").mkdir(parents=True, exist_ok=True)
    settings.forensic_diagnostics_dir.mkdir(parents=True, exist_ok=True)
    settings.storage_root_dir.mkdir(parents=True, exist_ok=True)
    (settings.storage_root_dir / "originals").mkdir(parents=True, exist_ok=True)
    (settings.storage_root_dir / "derivatives").mkdir(parents=True, exist_ok=True)
    (settings.storage_root_dir / "forensics").mkdir(parents=True, exist_ok=True)
    logger.info("Upload directory ready", path=str(settings.upload_dir))

    yield  # application runs here

    # Graceful shutdown
    from app.database import close_engine
    from app.redis_client import close_redis

    await close_engine()
    await close_redis()
    logger.info("ShieldHer shutdown complete")


# ── Application factory ───────────────────────────────────────────────────
def create_app() -> FastAPI:
    app = FastAPI(
        title="ShieldHer API",
        description=(
            "Privacy-first image forensics and NCII victim-support platform."
        ),
        version="0.1.0",
        docs_url="/docs" if not settings.is_production else None,
        redoc_url="/redoc" if not settings.is_production else None,
        lifespan=lifespan,
    )

    # ── CORS ──────────────────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Trusted hosts (harden against Host header injection in production) ─
    if settings.is_production:
        app.add_middleware(
            TrustedHostMiddleware,
            allowed_hosts=["shieldher.app", "*.shieldher.app"],
        )

    # ── Exception handlers ────────────────────────────────────────────────
    register_exception_handlers(app)

    # ── Routers ───────────────────────────────────────────────────────────
    from app.api.health import router as health_router
    from app.api.upload import router as upload_router
    from app.api.verify import router as verify_router
    from app.api.forensics import router as forensics_router
    from app.api.workflow import router as workflow_router
    from app.api.auth import router as auth_router
    from app.api.cases import router as cases_router
    from app.api.reverse_search import router as reverse_search_router
    from app.api.elicitation import router as elicitation_router

    app.include_router(health_router)
    app.include_router(upload_router)
    app.include_router(verify_router)
    app.include_router(forensics_router)
    app.include_router(workflow_router)
    app.include_router(auth_router)
    app.include_router(cases_router)
    app.include_router(reverse_search_router)
    app.include_router(elicitation_router)

    logger.info("ShieldHer application initialised")
    return app


# ── Module-level app instance (used by uvicorn) ───────────────────────────
app = create_app()
