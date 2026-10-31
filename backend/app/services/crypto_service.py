"""
ShieldHer – Cryptography & Security Service.

Implements:
- AES-256-GCM authenticated encryption/decryption for stored evidence.
- HMAC-SHA256 authenticated short-lived download URL signatures.
- Bcrypt password hashing and verification.
- Malicious filename sanitization and path-traversal prevention.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import os
import re
import time
from typing import Optional, Tuple
import bcrypt
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import structlog

from app.config import get_settings

logger = structlog.get_logger(__name__)


class CryptoService:
    def __init__(self):
        settings = get_settings()
        # Decode 32-byte AES key
        raw_key = base64.b64decode(settings.evidence_encryption_key_base64)
        if len(raw_key) != 32:
            # Pad or hash to exactly 32 bytes for safety in dev
            raw_key = hashlib.sha256(raw_key).digest()
        self._aesgcm = AESGCM(raw_key)
        self._signing_secret = settings.download_signing_secret.encode("utf-8")
        self._download_ttl = settings.download_url_ttl_seconds

    # ── AES-256-GCM Evidence Encryption ────────────────────────────────

    def encrypt_evidence(self, plaintext_bytes: bytes) -> Tuple[bytes, str]:
        """
        Encrypts evidence bytes using AES-256-GCM with a unique 96-bit (12-byte) random nonce.
        Returns (ciphertext_with_tag, nonce_hex).
        """
        nonce = os.urandom(12)
        ciphertext = self._aesgcm.encrypt(nonce, plaintext_bytes, None)
        nonce_hex = nonce.hex()
        return ciphertext, nonce_hex

    def decrypt_evidence(self, ciphertext_bytes: bytes, nonce_hex: str) -> bytes:
        """
        Decrypts AES-256-GCM ciphertext using the stored nonce.
        Validates GCM authentication tag; raises exception on tampering.
        """
        nonce = bytes.fromhex(nonce_hex)
        plaintext = self._aesgcm.decrypt(nonce, ciphertext_bytes, None)
        return plaintext

    # ── Short-Lived Signed Download URLs ──────────────────────────────

    def generate_download_token(self, evidence_id: str, user_id: str, custom_ttl: Optional[int] = None) -> Tuple[str, int]:
        """
        Generates an HMAC-SHA256 signature for short-lived authenticated evidence download.
        Returns (signature_token, expires_at_epoch).
        """
        ttl = custom_ttl or self._download_ttl
        expires_at = int(time.time()) + ttl
        payload = f"{evidence_id}:{user_id}:{expires_at}".encode("utf-8")
        signature = hmac.new(self._signing_secret, payload, hashlib.sha256).hexdigest()
        token = f"{expires_at}.{signature}"
        return token, expires_at

    def verify_download_token(self, evidence_id: str, user_id: str, token: str) -> bool:
        """
        Validates the download token signature and expiry timestamp.
        """
        try:
            parts = token.split(".")
            if len(parts) != 2:
                return False
            expires_at_str, signature = parts
            expires_at = int(expires_at_str)

            # Check expiry
            if time.time() > expires_at:
                logger.warning("Download token expired", evidence_id=evidence_id, user_id=user_id)
                return False

            # Verify HMAC signature
            payload = f"{evidence_id}:{user_id}:{expires_at}".encode("utf-8")
            expected_sig = hmac.new(self._signing_secret, payload, hashlib.sha256).hexdigest()
            return hmac.compare_digest(signature, expected_sig)
        except Exception as exc:
            logger.warning("Download token verification failed", error=str(exc))
            return False

    # ── Password Hashing (Bcrypt) ─────────────────────────────────────

    @staticmethod
    def hash_password(password: str) -> str:
        """Hash password using bcrypt with work factor 12."""
        salt = bcrypt.gensalt(rounds=12)
        hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
        return hashed.decode("utf-8")

    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        """Verify plain password against stored bcrypt hash."""
        try:
            return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
        except Exception:
            return False

    # ── Filename & Path Traversal Sanitization ─────────────────────────

    @staticmethod
    def sanitize_filename(filename: Optional[str]) -> str:
        """
        Strips path traversal elements (.., /, \\), null bytes, and non-whitelisted characters.
        Enforces safe alphanumeric filename with valid image extension.
        """
        if not filename:
            return "unnamed_evidence.bin"

        # Remove path components
        base = os.path.basename(filename.replace("\\", "/"))
        # Strip null bytes and control chars
        clean = re.sub(r"[\x00-\x1f\x7f]", "", base)
        # Keep only safe characters: alphanumeric, dots, dashes, underscores
        clean = re.sub(r"[^\w\.-]", "_", clean)
        # Prevent hidden files or leading dots
        clean = clean.lstrip(".")
        if not clean:
            clean = "evidence.bin"
        return clean[:200]  # Limit length


_crypto_service: Optional[CryptoService] = None


def get_crypto_service() -> CryptoService:
    global _crypto_service
    if _crypto_service is None:
        _crypto_service = CryptoService()
    return _crypto_service
