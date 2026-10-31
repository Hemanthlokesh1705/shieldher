"""
ShieldHer – database session factory.

Uses SQLAlchemy 2 async engine backed by asyncpg.
The sync engine is provided for Alembic migrations only.
"""
from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncIterator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings
from app.logging_config import get_logger

logger = get_logger(__name__)

# ── Declarative base used by all ORM models ────────────────────────────────
class Base(DeclarativeBase):
    pass


# ── Module-level singletons (created once on startup) ─────────────────────
_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


def get_engine() -> AsyncEngine:
    global _engine
    if _engine is None:
        settings = get_settings()
        _engine = create_async_engine(
            settings.postgres_dsn,
            pool_pre_ping=True,
            pool_size=5,
            max_overflow=10,
            echo=not settings.is_production,
        )
        logger.info("Database engine created", dsn_host=settings.postgres_host)
    return _engine


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    global _session_factory
    if _session_factory is None:
        _session_factory = async_sessionmaker(
            bind=get_engine(),
            class_=AsyncSession,
            expire_on_commit=False,
        )
    return _session_factory


@asynccontextmanager
async def get_db_session() -> AsyncIterator[AsyncSession]:
    """Async context manager that yields a database session."""
    factory = get_session_factory()
    async with factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def close_engine() -> None:
    """Dispose of the engine (called on application shutdown)."""
    global _engine
    if _engine is not None:
        await _engine.dispose()
        _engine = None
        logger.info("Database engine closed")
