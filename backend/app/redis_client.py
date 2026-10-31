"""
ShieldHer – Redis client factory.
"""
from __future__ import annotations

import redis.asyncio as aioredis

from app.config import get_settings
from app.logging_config import get_logger

logger = get_logger(__name__)

_redis_client: aioredis.Redis | None = None


def get_redis() -> aioredis.Redis:
    """Return (or lazily create) the shared async Redis client."""
    global _redis_client
    if _redis_client is None:
        settings = get_settings()
        _redis_client = aioredis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
        )
        logger.info("Redis client created", url=settings.redis_url)
    return _redis_client


async def close_redis() -> None:
    """Close the Redis connection pool."""
    global _redis_client
    if _redis_client is not None:
        await _redis_client.aclose()
        _redis_client = None
        logger.info("Redis connection closed")
