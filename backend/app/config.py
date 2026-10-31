"""
ShieldHer – application configuration.

All settings are loaded from environment variables (or a .env file).
Pydantic-Settings validates types and raises on startup if required
values are missing.
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import List, Optional, Union

from pydantic import field_validator, AnyHttpUrl
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Application ────────────────────────────────────────────
    app_env: str = "development"
    app_secret_key: str = "change-me-in-production"
    log_level: str = "INFO"

    # ── Server ─────────────────────────────────────────────────
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000
    allowed_origins: Union[List[str], str] = [
        "http://localhost:5173",
        "http://localhost:4173",
    ]

    @field_validator("allowed_origins", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Any) -> List[str]:
        if isinstance(v, str):
            if v.startswith("[") and v.endswith("]"):
                import json
                try:
                    return json.loads(v)
                except Exception:
                    pass
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, (list, tuple)):
            return list(v)
        return []

    # ── PostgreSQL ─────────────────────────────────────────────
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_db: str = "shieldher"
    postgres_user: str = "shieldher"
    postgres_password: str = "change-me"

    # ── Redis ──────────────────────────────────────────────────
    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_db: int = 0

    # ── File storage ───────────────────────────────────────────
    upload_dir: Path = (
        Path("/app/uploads")
        if Path("/app").exists()
        else Path(__file__).resolve().parent.parent / "uploads"
    )

    @field_validator("upload_dir", mode="before")
    @classmethod
    def resolve_upload_dir(cls, v: Any) -> Path:
        if str(v) == "/app/uploads" and not Path("/app").exists():
            return Path(__file__).resolve().parent.parent / "uploads"
        return Path(v) if v else Path(__file__).resolve().parent.parent / "uploads"
    max_upload_bytes: int = 20 * 1024 * 1024  # 20 MB

    # ── ML (optional) ──────────────────────────────────────────
    ml_device: str = "cpu"
    ml_model_cache_dir: Path = (
        Path("/app/models/weights")
        if Path("/app").exists()
        else Path(__file__).resolve().parent.parent / "models" / "weights"
    )

    # ── Quality Assessment Thresholds (PROVISIONAL) ────────────
    # NOTE: All quality thresholds below are provisional engineering
    # baselines and MUST be calibrated against representative NCII
    # forensic datasets prior to production deployment.
    quality_thresholds_provisional: bool = True
    min_image_width: int = 200
    min_image_height: int = 200
    max_image_pixels: int = 50_000_000  # 50 MP safeguard against decompression bombs
    min_face_width: int = 64
    min_face_height: int = 64
    min_sharpness_score: float = 50.0  # Laplacian variance (provisional)
    min_brightness: float = 40.0  # Mean luminance [0-255] (provisional)
    max_brightness: float = 220.0  # Mean luminance [0-255] (provisional)
    min_contrast: float = 20.0  # Luminance std deviation (provisional)
    min_face_confidence: float = 0.50  # MediaPipe face detector confidence (provisional)

    # ── Effort-AIGI-Detection Settings ─────────────────────────
    # Official checkpoint: effort_clip_L14_trainOn_FaceForensic.pth
    # Download link: https://drive.google.com/file/d/1m4fyJecABU-Yk3bJ4b1WhUwQa0xCkMLI/view?usp=drive_link
    effort_checkpoint_path: Path = (
        Path("/app/models/weights/effort_clip_L14_trainOn_FaceForensic.pth")
        if Path("/app").exists()
        else Path(__file__).resolve().parent.parent / "models" / "weights" / "effort_clip_L14_trainOn_FaceForensic.pth"
    )
    effort_device: str = "cpu"
    effort_decision_threshold: float = 0.50  # Decision threshold for manipulation classification (provisional)

    # ── Smaug-AI-Image-Detector Settings ───────────────────────
    # Official Hugging Face model: abacusai/Smaug-AI-Image-Detector
    # Vision-only EmbeddingGemma-2 architecture (439M parameters)
    smaug_model_id: str = "abacusai/Smaug-AI-Image-Detector"
    smaug_weights_path: Path = (
        Path("/app/models/weights/smaug")
        if Path("/app").exists()
        else Path(__file__).resolve().parent.parent / "models" / "weights" / "smaug"
    )
    smaug_device: str = "cpu"
    smaug_decision_threshold: float = 0.50  # Provisional threshold (0.5 recommended by Abacus.AI)
    smaug_num_crops: int = 3  # 3 native-resolution 528x528 crops (start, centre, end) or 1 (centre only)

    # ── Forensic Analysis Module Settings ──────────────────────
    forensic_diagnostics_dir: Path = (
        Path("/app/uploads/diagnostics")
        if Path("/app").exists()
        else Path(__file__).resolve().parent.parent / "uploads" / "diagnostics"
    )
    ela_jpeg_quality: int = 90  # Standard recompression quality for Error Level Analysis
    ela_scale_factor: float = 10.0  # Amplification multiplier for ELA visual difference
    # Optional pretrained forensic models: disabled by default pending legal/usage terms review
    enable_fsd: bool = False  # CVPR 2025 FSD (CC BY-NC-SA 4.0)
    enable_trufor: bool = False  # CVPR 2023 TruFor (Academic non-profit license)

    # ── Authentication & Security ──────────────────────────────
    jwt_secret_key: str = "shieldher-dev-secret-key-change-in-production-32b"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 120
    # 32-byte AES-256 key in base64 (must be configured via ENV in production)
    # Default is a 32-byte base64 string for local development only
    evidence_encryption_key_base64: str = "c2hpZWxkaGVyLWVuY3J5cHRpb24ta2V5LTMyLWJ5dGVzLSE="
    download_signing_secret: str = "shieldher-download-signing-secret-change-in-production"
    download_url_ttl_seconds: int = 900  # 15 minutes authenticated access window

    # ── Object Storage & Retention ─────────────────────────────
    storage_backend: str = "local"  # "local" or "s3"
    storage_root_dir: Path = (
        Path("/app/uploads/secure_storage")
        if Path("/app").exists()
        else Path(__file__).resolve().parent.parent / "uploads" / "secure_storage"
    )
    exploratory_retention_hours: int = 24  # Temporary exploratory uploads expire in 24h by default
    default_evidence_retention_days: int = 365  # Preserved evidence retained for 1 year by default
    max_upload_size_bytes: int = 25 * 1024 * 1024  # 25 MB safeguard

    # ── Reverse Image Search & Provider Settings ───────────────
    # Provider: SerpApi Google Lens API (https://serpapi.com/google-lens-api)
    serpapi_api_key: Optional[str] = None
    serpapi_base_url: str = "https://serpapi.com/search"
    reverse_search_rate_limit_per_minute: int = 10
    reverse_search_daily_budget_per_case: int = 5
    reverse_search_timeout_seconds: float = 15.0
    reverse_search_enabled: bool = True

    # ── Mistral AI API & Victim Information Elicitation Settings ───
    # Used strictly for constrained complaint drafting and structured elicitation.
    # NEVER sends image bytes, intimate crops, or unnecessary personal info to the LLM.
    mistral_api_key: Optional[str] = None
    mistral_model: str = "mistral-large-latest"
    mistral_max_tokens: int = 2048
    mistral_timeout_seconds: float = 30.0

    # Backwards-compatible legacy aliases
    anthropic_api_key: Optional[str] = None
    anthropic_model: str = "mistral-large-latest"
    anthropic_max_tokens: int = 2048
    anthropic_timeout_seconds: float = 30.0
    elicit_max_rounds: int = 3

    @property
    def effective_mistral_api_key(self) -> Optional[str]:
        return self.mistral_api_key or self.anthropic_api_key

    # ── Derived helpers ────────────────────────────────────────
    @property
    def postgres_dsn(self) -> str:
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def postgres_dsn_sync(self) -> str:
        """Sync DSN for Alembic migrations."""
        return (
            f"postgresql://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def redis_url(self) -> str:
        return f"redis://{self.redis_host}:{self.redis_port}/{self.redis_db}"

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @field_validator("log_level")
    @classmethod
    def validate_log_level(cls, v: str) -> str:
        allowed = {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}
        upper = v.upper()
        if upper not in allowed:
            raise ValueError(f"log_level must be one of {allowed}")
        return upper


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return a cached singleton Settings instance."""
    return Settings()
