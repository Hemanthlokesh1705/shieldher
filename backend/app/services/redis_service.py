"""
ShieldHer – Redis Service for Transient Sessions and Background Jobs.

Provides:
- Temporary exploratory upload sessions with auto-expiring TTLs.
- Background forensic processing job progress & status tracking.
- Revoked token blacklist for authenticated sessions.
"""
from __future__ import annotations

import json
import time
from typing import Any, Dict, Optional
import redis.exceptions
import structlog

from app.redis_client import get_redis

logger = structlog.get_logger(__name__)


class InMemoryRedis:
    """In-memory dictionary fallback when Redis server is unreachable or offline."""

    def __init__(self):
        self._store: Dict[str, tuple[str, float]] = {}

    async def setex(self, name: str, time_sec: int, value: str) -> bool:
        self._store[name] = (str(value), time.time() + float(time_sec))
        return True

    async def get(self, name: str) -> Optional[str]:
        if name in self._store:
            val, exp = self._store[name]
            if time.time() > exp:
                del self._store[name]
                return None
            return val
        return None

    async def delete(self, *names: str) -> int:
        count = 0
        for n in names:
            if n in self._store:
                del self._store[n]
                count += 1
        return count

    async def ttl(self, name: str) -> int:
        if name in self._store:
            val, exp = self._store[name]
            remaining = int(exp - time.time())
            if remaining <= 0:
                del self._store[name]
                return -2
            return remaining
        return -2

    async def exists(self, *names: str) -> int:
        count = 0
        for n in names:
            if await self.get(n) is not None:
                count += 1
        return count


class RedisService:
    def __init__(self, redis_client=None):
        self._redis = redis_client
        self._fallback = InMemoryRedis()
        self._using_fallback = False

    async def _execute(self, method_name: str, *args, **kwargs) -> Any:
        """Attempt Redis operation; fail over gracefully to in-memory store if Redis is unavailable."""
        if not self._using_fallback:
            try:
                client = self._redis if self._redis is not None else get_redis()
                func = getattr(client, method_name)
                return await func(*args, **kwargs)
            except (redis.exceptions.ConnectionError, redis.exceptions.TimeoutError, ConnectionRefusedError, OSError) as exc:
                logger.warning(
                    "Redis server unreachable; activating in-memory transient store fallback",
                    error=str(exc),
                )
                self._using_fallback = True
            except Exception as e:
                # If error is due to connection failure in retry logic
                if "connecting" in str(e).lower() or "connection" in str(e).lower():
                    logger.warning("Redis connection error; activating in-memory fallback", error=str(e))
                    self._using_fallback = True
                else:
                    raise

        fallback_func = getattr(self._fallback, method_name)
        return await fallback_func(*args, **kwargs)

    # ── 1. Temporary Exploratory Sessions ──────────────────────────────

    async def set_exploratory_session(
        self,
        session_id: str,
        case_id: str,
        metadata: Optional[Dict[str, Any]] = None,
        ttl_seconds: int = 86400,  # 24 hours default
    ) -> None:
        key = f"shieldher:exploratory:{session_id}"
        payload = {
            "session_id": session_id,
            "case_id": case_id,
            "created_at": time.time(),
            "expires_at": time.time() + ttl_seconds,
            "metadata": metadata or {},
        }
        await self._execute("setex", key, ttl_seconds, json.dumps(payload))
        logger.info("Recorded exploratory session in Redis", session_id=session_id, ttl=ttl_seconds)

    async def get_exploratory_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        key = f"shieldher:exploratory:{session_id}"
        data = await self._execute("get", key)
        if data:
            return json.loads(data)
        return None

    async def delete_exploratory_session(self, session_id: str) -> None:
        key = f"shieldher:exploratory:{session_id}"
        await self._execute("delete", key)

    # ── 2. Background Job Tracking ─────────────────────────────────────

    async def create_job(
        self,
        job_id: str,
        case_id: str,
        job_type: str,
        metadata: Optional[Dict[str, Any]] = None,
        ttl_seconds: int = 86400,
    ) -> Dict[str, Any]:
        key = f"shieldher:job:{job_id}"
        job_data = {
            "job_id": job_id,
            "case_id": case_id,
            "job_type": job_type,
            "status": "QUEUED",
            "progress": 0.0,
            "created_at": time.time(),
            "updated_at": time.time(),
            "metadata": metadata or {},
            "result": None,
            "error": None,
        }
        await self._execute("setex", key, ttl_seconds, json.dumps(job_data))
        return job_data

    async def update_job(
        self,
        job_id: str,
        status: str,
        progress: float = 0.0,
        result: Optional[Dict[str, Any]] = None,
        error: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        key = f"shieldher:job:{job_id}"
        existing = await self.get_job(job_id)
        if not existing:
            return None

        existing["status"] = status
        existing["progress"] = progress
        existing["updated_at"] = time.time()
        if result is not None:
            existing["result"] = result
        if error is not None:
            existing["error"] = error

        ttl = await self._execute("ttl", key)
        if ttl <= 0:
            ttl = 86400
        await self._execute("setex", key, ttl, json.dumps(existing))
        return existing

    async def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        key = f"shieldher:job:{job_id}"
        data = await self._execute("get", key)
        if data:
            return json.loads(data)
        return None

    # ── 3. Token Revocation / Blacklist ────────────────────────────────

    async def revoke_token(self, jti: str, ttl_seconds: int) -> None:
        key = f"shieldher:revoked_token:{jti}"
        await self._execute("setex", key, ttl_seconds, "revoked")

    async def is_token_revoked(self, jti: str) -> bool:
        key = f"shieldher:revoked_token:{jti}"
        exists = await self._execute("exists", key)
        return exists > 0

    # ── 4. Search Budget & Rate Limiting ───────────────────────────────

    async def check_and_consume_search_budget(
        self, case_id: str, daily_limit: int = 5
    ) -> tuple[bool, int, int]:
        """
        Check and consume the daily search budget for a case.
        Returns: (is_allowed, remaining_budget, ttl_seconds_until_reset)
        """
        today = time.strftime("%Y%m%d", time.gmtime())
        key = f"shieldher:budget:search:{case_id}:{today}"
        current = await self._execute("get", key)
        count = int(current) if current else 0

        if count >= daily_limit:
            ttl = await self._execute("ttl", key)
            return False, 0, max(ttl, 0)

        new_count = count + 1
        ttl = await self._execute("ttl", key)
        if ttl <= 0:
            ttl = 86400  # 24 hours
        await self._execute("setex", key, ttl, str(new_count))
        remaining = max(0, daily_limit - new_count)
        return True, remaining, ttl

    async def get_search_budget_remaining(
        self, case_id: str, daily_limit: int = 5
    ) -> tuple[int, int]:
        """Returns (remaining_budget, ttl_seconds_until_reset) without consuming."""
        today = time.strftime("%Y%m%d", time.gmtime())
        key = f"shieldher:budget:search:{case_id}:{today}"
        current = await self._execute("get", key)
        count = int(current) if current else 0
        remaining = max(0, daily_limit - count)
        ttl = await self._execute("ttl", key)
        return remaining, max(ttl, 0)

    async def check_rate_limit(
        self, key_suffix: str, max_requests: int = 10, window_seconds: int = 60
    ) -> bool:
        """Fixed-window rate limiter per key suffix."""
        key = f"shieldher:ratelimit:{key_suffix}"
        current = await self._execute("get", key)
        count = int(current) if current else 0
        if count >= max_requests:
            return False
        new_count = count + 1
        ttl = await self._execute("ttl", key)
        if ttl <= 0:
            ttl = window_seconds
        await self._execute("setex", key, ttl, str(new_count))
        return True


_redis_service: Optional[RedisService] = None


def get_redis_service() -> RedisService:
    global _redis_service
    if _redis_service is None:
        _redis_service = RedisService()
    return _redis_service
