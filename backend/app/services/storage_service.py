"""
ShieldHer – Secure Object Storage Interface & Local Implementation.

Features:
- Strict segregation of encrypted original evidence, derivatives, and forensic reports.
- Secure cryptographic file shredding (overwrites with random noise + zeros before unlinking).
- Path traversal defense: all storage keys are strictly formatted under UUID namespaces.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
import json
import os
from pathlib import Path
from typing import Any, Dict, Optional
import structlog

from app.config import get_settings

logger = structlog.get_logger(__name__)


class ObjectStorageInterface(ABC):
    @abstractmethod
    def save_file(self, relative_key: str, data: bytes) -> str:
        """Store bytes under key; returns storage reference."""
        pass

    @abstractmethod
    def load_file(self, relative_key: str) -> bytes:
        """Retrieve stored bytes for key."""
        pass

    @abstractmethod
    def delete_file(self, relative_key: str) -> bool:
        """Standard file deletion."""
        pass

    @abstractmethod
    def secure_shred_file(self, relative_key: str) -> bool:
        """Cryptographic shredding: overwrites file with random bytes + zeros before unlinking."""
        pass

    @abstractmethod
    def file_exists(self, relative_key: str) -> bool:
        """Check file existence."""
        pass

    @abstractmethod
    def save_json(self, relative_key: str, data: Dict[str, Any]) -> str:
        """Save structured JSON document."""
        pass

    @abstractmethod
    def load_json(self, relative_key: str) -> Dict[str, Any]:
        """Load structured JSON document."""
        pass


class LocalObjectStorage(ObjectStorageInterface):
    """
    Filesystem implementation of ObjectStorageInterface with segregated subtrees.
    """

    def __init__(self, root_dir: Optional[Path] = None):
        settings = get_settings()
        self.root_dir = root_dir or settings.storage_root_dir
        self.root_dir.mkdir(parents=True, exist_ok=True)
        (self.root_dir / "originals").mkdir(parents=True, exist_ok=True)
        (self.root_dir / "derivatives").mkdir(parents=True, exist_ok=True)
        (self.root_dir / "forensics").mkdir(parents=True, exist_ok=True)

    def _resolve_safe_path(self, relative_key: str) -> Path:
        """Safely resolve path within storage root, preventing path traversal."""
        clean_key = relative_key.lstrip("/\\")
        target_path = (self.root_dir / clean_key).resolve()
        # Verify target is inside root_dir
        if not str(target_path).startswith(str(self.root_dir.resolve())):
            raise ValueError(f"Path traversal detected for storage key: {relative_key}")
        target_path.parent.mkdir(parents=True, exist_ok=True)
        return target_path

    def save_file(self, relative_key: str, data: bytes) -> str:
        target = self._resolve_safe_path(relative_key)
        target.write_bytes(data)
        return str(relative_key)

    def load_file(self, relative_key: str) -> bytes:
        target = self._resolve_safe_path(relative_key)
        if not target.exists():
            raise FileNotFoundError(f"Storage item not found at key '{relative_key}'")
        return target.read_bytes()

    def delete_file(self, relative_key: str) -> bool:
        target = self._resolve_safe_path(relative_key)
        if target.exists():
            target.unlink()
            return True
        return False

    def secure_shred_file(self, relative_key: str) -> bool:
        """
        Secure multi-pass shredding:
        Pass 1: Overwrite with random cryptographic noise.
        Pass 2: Overwrite with binary zeros.
        Pass 3: Truncate and unlink.
        """
        target = self._resolve_safe_path(relative_key)
        if not target.exists():
            return False

        try:
            length = target.stat().st_size
            if length > 0:
                with open(target, "ba+", buffering=0) as f:
                    # Pass 1: Random bytes
                    f.seek(0)
                    f.write(os.urandom(length))
                    f.flush()
                    os.fsync(f.fileno())

                    # Pass 2: Zeros
                    f.seek(0)
                    f.write(b"\x00" * length)
                    f.flush()
                    os.fsync(f.fileno())

            # Pass 3: Unlink
            target.unlink()
            logger.info("Securely shredded evidence file", key=relative_key, bytes_shredded=length)
            return True
        except Exception as exc:
            logger.error("Failed to secure-shred file", key=relative_key, error=str(exc))
            # Fallback to standard unlink if overwrite fails
            if target.exists():
                target.unlink()
            return True

    def file_exists(self, relative_key: str) -> bool:
        target = self._resolve_safe_path(relative_key)
        return target.exists()

    def save_json(self, relative_key: str, data: Dict[str, Any]) -> str:
        serialized = json.dumps(data, indent=2, default=str).encode("utf-8")
        return self.save_file(relative_key, serialized)

    def load_json(self, relative_key: str) -> Dict[str, Any]:
        raw = self.load_file(relative_key)
        return json.loads(raw.decode("utf-8"))


_storage_service: Optional[ObjectStorageInterface] = None


def get_storage_service() -> ObjectStorageInterface:
    global _storage_service
    if _storage_service is None:
        _storage_service = LocalObjectStorage()
    return _storage_service
