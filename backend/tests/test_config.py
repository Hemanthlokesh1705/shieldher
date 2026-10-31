"""
Tests for application configuration loading.
"""
from __future__ import annotations

from app.config import Settings


def test_default_settings_load():
    """Settings can be instantiated with all defaults (no .env required)."""
    s = Settings()
    assert s.app_env == "development"
    assert s.backend_port == 8000
    assert s.postgres_port == 5432
    assert s.redis_port == 6379
    assert s.max_upload_bytes == 20 * 1024 * 1024


def test_postgres_dsn_format():
    s = Settings(
        postgres_user="testuser",
        postgres_password="testpass",
        postgres_host="dbhost",
        postgres_port=5432,
        postgres_db="testdb",
    )
    dsn = s.postgres_dsn
    assert "asyncpg" in dsn
    assert "testuser" in dsn
    assert "dbhost" in dsn
    assert "testdb" in dsn


def test_redis_url_format():
    s = Settings(redis_host="redishost", redis_port=6380, redis_db=1)
    assert s.redis_url == "redis://redishost:6380/1"


def test_is_production_flag():
    dev = Settings(app_env="development")
    prod = Settings(app_env="production")
    assert not dev.is_production
    assert prod.is_production


def test_mistral_settings():
    s = Settings(mistral_api_key="mistral_test_secret", mistral_model="mistral-large-latest")
    assert s.mistral_api_key == "mistral_test_secret"
    assert s.effective_mistral_api_key == "mistral_test_secret"
    assert s.mistral_model == "mistral-large-latest"

    # Fallback to legacy key
    s2 = Settings(anthropic_api_key="anthropic_legacy_secret")
    assert s2.effective_mistral_api_key == "anthropic_legacy_secret"


def test_log_level_validation():
    import pytest

    with pytest.raises(Exception):
        Settings(log_level="INVALID")
