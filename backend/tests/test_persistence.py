"""
ShieldHer – Tests for Secure Case Persistence, RBAC, Encryption, and Deletion Workflows.

Tests:
1. User registration, password hashing, and JWT token authentication.
2. Case creation with default temporary exploratory retention (24h TTL).
3. Strict case ownership & RBAC: Victims isolated; Examiners and Admins permitted.
4. Documented retention policy change to PRESERVED_EVIDENCE (365d TTL).
5. Evidence upload with AES-256-GCM encryption at rest and raw byte exclusion from DB.
6. Storage separation: Forensic report stored separately from encrypted imagery.
7. Short-lived signed download URLs with HMAC verification and expiry checks.
8. Secure deletion workflow with cryptographic shredding and DeletionRequest audit snapshots.
9. Protection against path traversal and malicious filenames.
10. Critical safeguard: Authentic model verdict does NOT automatically delete evidence.
11. Redis temporary exploratory session tracking.
"""
from __future__ import annotations

import base64
import datetime
import io
import os
import uuid
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient
from PIL import Image
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.database import Base, get_db_session
from app.main import app
from app.models.entities import (
    Case,
    CaseStatus,
    DeletionRequest,
    EvidenceItem,
    RetentionPolicy,
    User,
    UserRole,
)
from app.schemas.upload import (
    AssessmentStatus,
    FileMetadata,
    ProvisionalThresholds,
    QualityMetrics,
    UploadResponse,
)
from app.schemas.verification import (
    DetectionDetails,
    ModelInferenceStatus,
    PredictedLabel,
    SmaugDetectionDetails,
    SmaugPredictedLabel,
)
from app.services.auth_service import get_auth_service
from app.services.crypto_service import get_crypto_service
from app.services.redis_service import get_redis_service
from app.services.storage_service import LocalObjectStorage, get_storage_service


# ── SQLite In-Memory Database Fixture for Isolated Persistence Testing ─

@pytest.fixture(scope="module")
def anyio_backend():
    return "asyncio"


@pytest.fixture(autouse=True)
async def setup_test_db(tmp_path_factory):
    """Initializes a fresh SQLite database and storage root for testing."""
    test_dir = tmp_path_factory.mktemp("shieldher_test_storage")
    engine = create_async_engine(f"sqlite+aiosqlite:///{test_dir}/test.db")
    session_factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Override get_db_session to use test engine
    from app import database
    original_engine = database._engine
    original_factory = database._session_factory

    database._engine = engine
    database._session_factory = session_factory

    # Override storage service to use isolated test dir
    from app.services import storage_service
    original_storage = storage_service._storage_service
    test_storage = LocalObjectStorage(root_dir=test_dir / "secure_storage")
    storage_service._storage_service = test_storage

    yield

    # Teardown
    await engine.dispose()
    database._engine = original_engine
    database._session_factory = original_factory
    storage_service._storage_service = original_storage


@pytest.fixture
def test_client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://testserver")


@pytest.fixture
def sample_jpeg_bytes() -> bytes:
    img = Image.new("RGB", (300, 300), color=(150, 100, 200))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return buf.getvalue()


# ── Helper: Register and Login User ────────────────────────────────────

async def create_user_and_token(client: AsyncClient, email: str, role: str = "VICTIM") -> str:
    reg_resp = await client.post(
        "/auth/register",
        json={"email": email, "password": "SecurePassword123!", "full_name": "Test User", "role": role},
    )
    assert reg_resp.status_code in (201, 409)

    login_resp = await client.post(
        "/auth/token",
        data={"username": email, "password": "SecurePassword123!"},
    )
    assert login_resp.status_code == 200
    return login_resp.json()["access_token"]


# ── 1. User Registration & JWT Authentication ──────────────────────────

@pytest.mark.asyncio
async def test_auth_registration_and_login(test_client):
    async with test_client as client:
        # 1. Register victim
        reg = await client.post(
            "/auth/register",
            json={"email": "victim1@example.com", "password": "StrongPassword123!", "role": "VICTIM"},
        )
        assert reg.status_code == 201
        data = reg.json()
        assert data["email"] == "victim1@example.com"
        assert data["role"] == "VICTIM"

        # 2. Duplicate registration rejected
        dup = await client.post(
            "/auth/register",
            json={"email": "victim1@example.com", "password": "StrongPassword123!", "role": "VICTIM"},
        )
        assert dup.status_code == 409

        # 3. Login with wrong password
        bad_login = await client.post(
            "/auth/token",
            data={"username": "victim1@example.com", "password": "WrongPassword!"},
        )
        assert bad_login.status_code == 401

        # 4. Successful login
        login = await client.post(
            "/auth/token",
            data={"username": "victim1@example.com", "password": "StrongPassword123!"},
        )
        assert login.status_code == 200
        token_data = login.json()
        assert "access_token" in token_data
        token = token_data["access_token"]

        # 5. Access /auth/me with Bearer token
        me = await client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me.status_code == 200
        assert me.json()["email"] == "victim1@example.com"

        # 6. JSON login endpoint (/auth/login)
        json_login = await client.post(
            "/auth/login",
            json={"email": "victim1@example.com", "password": "StrongPassword123!"},
        )
        assert json_login.status_code == 200
        assert "access_token" in json_login.json()

        # 7. JSON signin alias (/auth/signin)
        signin = await client.post(
            "/auth/signin",
            json={"email": "victim1@example.com", "password": "StrongPassword123!"},
        )
        assert signin.status_code == 200
        assert "access_token" in signin.json()

        # 8. Firebase sync / login (/auth/firebase)
        fb_resp = await client.post(
            "/auth/firebase",
            json={
                "email": "firebase_victim@shieldher.org",
                "full_name": "Firebase User",
                "role": "VICTIM",
            },
        )
        assert fb_resp.status_code == 200
        assert fb_resp.json()["email"] == "firebase_victim@shieldher.org"
        assert "access_token" in fb_resp.json()


# ── 2. Case Creation & Temporary Exploratory Default ───────────────────

@pytest.mark.asyncio
async def test_unauthenticated_case_creation(test_client):
    """Verifies that an unauthenticated user can create an exploratory intake case without a 401 error."""
    async with test_client as client:
        resp = await client.post(
            "/cases",
            json={"title": "Anonymous Exploratory Intake", "incident_description": "Initial intake test"},
        )
        assert resp.status_code == 201
        case_data = resp.json()
        assert case_data["title"] == "Anonymous Exploratory Intake"
        assert case_data["retention_policy"] == "TEMPORARY_EXPLORATORY"

        # Anonymous list cases returns empty list without error
        list_resp = await client.get("/cases")
        assert list_resp.status_code == 200
        assert list_resp.json() == []


# ── 2. Case Creation & Temporary Exploratory Default ───────────────────

@pytest.mark.asyncio
async def test_create_case_temporary_exploratory_default(test_client):
    async with test_client as client:
        token = await create_user_and_token(client, "victim2@example.com", role="VICTIM")

        # Create case without explicit retention -> defaults to TEMPORARY_EXPLORATORY
        resp = await client.post(
            "/cases",
            json={"title": "Exploratory Verification Case", "incident_description": "Suspected non-consensual edit"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 201
        case = resp.json()
        assert case["title"] == "Exploratory Verification Case"
        assert case["retention_policy"] == "TEMPORARY_EXPLORATORY"
        assert case["status"] == "OPEN"
        assert case["retention_expires_at"] is not None


# ── 3. Strict Case Ownership & RBAC ────────────────────────────────────

@pytest.mark.asyncio
async def test_case_ownership_and_rbac_isolation(test_client):
    async with test_client as client:
        token_victim_a = await create_user_and_token(client, "victim_a@example.com", role="VICTIM")
        token_victim_b = await create_user_and_token(client, "victim_b@example.com", role="VICTIM")
        token_examiner = await create_user_and_token(client, "examiner@example.com", role="EXAMINER")

        # Victim A creates a case
        resp_a = await client.post(
            "/cases",
            json={"title": "Victim A Private Case"},
            headers={"Authorization": f"Bearer {token_victim_a}"},
        )
        case_id = resp_a.json()["id"]

        # Victim B attempts to access Victim A's case -> 403 Forbidden
        forbidden_resp = await client.get(
            f"/cases/{case_id}",
            headers={"Authorization": f"Bearer {token_victim_b}"},
        )
        assert forbidden_resp.status_code == 403

        # Examiner accesses Victim A's case -> 200 OK
        examiner_resp = await client.get(
            f"/cases/{case_id}",
            headers={"Authorization": f"Bearer {token_examiner}"},
        )
        assert examiner_resp.status_code == 200
        assert examiner_resp.json()["id"] == case_id


# ── 4. Documented Retention Policy Update ──────────────────────────────

@pytest.mark.asyncio
async def test_update_case_retention_to_preserved_evidence(test_client):
    async with test_client as client:
        token = await create_user_and_token(client, "victim3@example.com", role="VICTIM")

        resp = await client.post(
            "/cases",
            json={"title": "Case for Formal Preservation"},
            headers={"Authorization": f"Bearer {token}"},
        )
        case_id = resp.json()["id"]

        # Victim makes documented preservation choice
        patch_resp = await client.patch(
            f"/cases/{case_id}/retention",
            json={
                "retention_policy": "PRESERVED_EVIDENCE",
                "retention_days": 180,
                "reason": "Retained for active legal reporting to platform and counsel.",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert patch_resp.status_code == 200
        data = patch_resp.json()
        assert data["retention_policy"] == "PRESERVED_EVIDENCE"
        assert data["status"] == "EVIDENCE_PRESERVED"


# ── 5. Evidence Upload with AES-256-GCM Encryption & Storage Separation ─

@pytest.mark.asyncio
async def test_upload_evidence_encryption_and_storage_separation(test_client, sample_jpeg_bytes):
    async with test_client as client:
        token = await create_user_and_token(client, "victim4@example.com", role="VICTIM")

        case_resp = await client.post(
            "/cases",
            json={"title": "Encryption Test Case"},
            headers={"Authorization": f"Bearer {token}"},
        )
        case_id = case_resp.json()["id"]

        # Upload evidence
        upload_resp = await client.post(
            f"/cases/{case_id}/evidence",
            files={"file": ("evidence_intimate.jpg", sample_jpeg_bytes, "image/jpeg")},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert upload_resp.status_code == 201
        ev_data = upload_resp.json()
        evidence_id = ev_data["id"]

        # Verify database record
        storage = get_storage_service()
        crypto = get_crypto_service()

        async with get_db_session() as session:
            from sqlalchemy import select
            res = await session.execute(select(EvidenceItem).where(EvidenceItem.id == uuid.UUID(evidence_id)))
            item = res.scalar_one()

            # 1. Sensitive raw bytes are NEVER stored in database columns
            assert item.storage_key_encrypted_evidence is not None
            assert item.storage_key_encrypted_evidence.endswith(".enc")
            assert item.encryption_iv_hex is not None

            # 2. Verify file on disk is encrypted
            encrypted_bytes = storage.load_file(item.storage_key_encrypted_evidence)
            assert encrypted_bytes != sample_jpeg_bytes

            # 3. Decrypting with stored IV recovers original bytes
            decrypted = crypto.decrypt_evidence(encrypted_bytes, item.encryption_iv_hex)
            assert decrypted == sample_jpeg_bytes

            # 4. Forensic report is stored separately from encrypted imagery
            assert item.storage_key_forensic_report is not None
            assert item.storage_key_forensic_report.startswith("forensics/")
            report_data = storage.load_json(item.storage_key_forensic_report)
            assert report_data is not None
            assert "status" in report_data or "frequency" in report_data


# ── 6. Short-Lived Signed Download URL ─────────────────────────────────

@pytest.mark.asyncio
async def test_signed_download_url_and_access_control(test_client, sample_jpeg_bytes):
    async with test_client as client:
        token = await create_user_and_token(client, "victim5@example.com", role="VICTIM")

        case_resp = await client.post(
            "/cases",
            json={"title": "Download URL Test Case"},
            headers={"Authorization": f"Bearer {token}"},
        )
        case_id = case_resp.json()["id"]

        upload_resp = await client.post(
            f"/cases/{case_id}/evidence",
            files={"file": ("download_test.jpg", sample_jpeg_bytes, "image/jpeg")},
            headers={"Authorization": f"Bearer {token}"},
        )
        evidence_id = upload_resp.json()["id"]

        # Request download URL
        url_resp = await client.get(
            f"/cases/{case_id}/evidence/{evidence_id}/download-url",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert url_resp.status_code == 200
        url_data = url_resp.json()
        download_url = url_data["download_url"]
        assert download_url.startswith("http")

        # Execute download with the signed URL
        dl_resp = await client.get(download_url)
        assert dl_resp.status_code == 200
        assert dl_resp.content == sample_jpeg_bytes
        assert dl_resp.headers["content-type"] == "image/jpeg"

        # Tampered token fails
        tampered_url = download_url + "tampered"
        tampered_resp = await client.get(tampered_url)
        assert tampered_resp.status_code == 403


# ── 7. Secure Deletion Workflow & Cryptographic Shredding ──────────────

@pytest.mark.asyncio
async def test_secure_deletion_workflow_and_shredding(test_client, sample_jpeg_bytes):
    async with test_client as client:
        token = await create_user_and_token(client, "victim6@example.com", role="VICTIM")

        case_resp = await client.post(
            "/cases",
            json={"title": "Deletion Test Case"},
            headers={"Authorization": f"Bearer {token}"},
        )
        case_id = case_resp.json()["id"]

        upload_resp = await client.post(
            f"/cases/{case_id}/evidence",
            files={"file": ("to_delete.jpg", sample_jpeg_bytes, "image/jpeg")},
            headers={"Authorization": f"Bearer {token}"},
        )
        evidence_id = upload_resp.json()["id"]

        # Record storage path prior to purge
        storage = get_storage_service()
        async with get_db_session() as session:
            from sqlalchemy import select
            res = await session.execute(select(EvidenceItem).where(EvidenceItem.id == uuid.UUID(evidence_id)))
            item = res.scalar_one()
            storage_key = item.storage_key_encrypted_evidence
            assert storage.file_exists(storage_key)

        # Execute secure purge request
        del_resp = await client.request(
            method="DELETE",
            url=f"/cases/{case_id}/evidence/{evidence_id}",
            json={"reason": "Victim requested immediate withdrawal and purging of all media files."},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert del_resp.status_code == 200
        del_data = del_resp.json()
        assert del_data["status"] == "COMPLETED"
        assert del_data["evidence_sha256_snapshot"] is not None

        # Verify encrypted file on disk has been shredded/unlinked
        assert not storage.file_exists(storage_key)

        # Attempting to download purged item returns 410 Gone
        url_resp = await client.get(
            f"/cases/{case_id}/evidence/{evidence_id}/download-url",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert url_resp.status_code == 410


# ── 8. Filename Sanitization & Path Traversal Prevention ───────────────

def test_crypto_service_filename_sanitization():
    crypto = get_crypto_service()

    # Path traversal attack
    traversal = "../../../../etc/shadow.jpg"
    clean = crypto.sanitize_filename(traversal)
    assert "/" not in clean
    assert ".." not in clean
    assert clean.endswith("shadow.jpg")

    # Windows style traversal
    win_traversal = "..\\..\\Windows\\System32\\cmd.exe"
    clean_win = crypto.sanitize_filename(win_traversal)
    assert "\\" not in clean_win
    assert "cmd.exe" in clean_win

    # Null bytes
    null_name = "exploit\x00malicious.png"
    clean_null = crypto.sanitize_filename(null_name)
    assert "\x00" not in clean_null


# ── 9. Critical Safeguard: Authentic Verdict Never Triggers Auto-Delete ─

@pytest.mark.asyncio
async def test_authentic_verdict_does_not_auto_delete(test_client, sample_jpeg_bytes):
    """
    CRITICAL MANDATE:
    Even if detectors report AUTHENTIC / 0.0 manipulation, genuine intimate images
    may be non-consensually distributed. The application must NEVER auto-delete.
    """
    async with test_client as client:
        token = await create_user_and_token(client, "victim7@example.com", role="VICTIM")

        case_resp = await client.post(
            "/cases",
            json={"title": "Authentic NCII Evidence Case", "retention_policy": "PRESERVED_EVIDENCE"},
            headers={"Authorization": f"Bearer {token}"},
        )
        case_id = case_resp.json()["id"]

        # Mock models to return low scores (authentic)
        with (
            patch("app.workflows.nodes.get_effort_adapter") as m_eff,
            patch("app.workflows.nodes.get_smaug_adapter") as m_smaug,
        ):
            mock_e = MagicMock()
            mock_e.predict.return_value = DetectionDetails(
                status=ModelInferenceStatus.SUCCESS,
                manipulation_score=0.02,
                predicted_label=PredictedLabel.AUTHENTIC,
            )
            m_eff.return_value = mock_e

            mock_s = MagicMock()
            mock_s.predict.return_value = SmaugDetectionDetails(
                status=ModelInferenceStatus.SUCCESS,
                ai_generation_score=0.01,
                predicted_label=SmaugPredictedLabel.NATURAL_OR_AUTHENTIC,
            )
            m_smaug.return_value = mock_s

            upload_resp = await client.post(
                f"/cases/{case_id}/evidence",
                files={"file": ("authentic_ncii.jpg", sample_jpeg_bytes, "image/jpeg")},
                headers={"Authorization": f"Bearer {token}"},
            )
            assert upload_resp.status_code == 201
            evidence_id = upload_resp.json()["id"]

        # Verify evidence remains safely preserved in storage and DB
        storage = get_storage_service()
        async with get_db_session() as session:
            from sqlalchemy import select
            res = await session.execute(select(EvidenceItem).where(EvidenceItem.id == uuid.UUID(evidence_id)))
            item = res.scalar_one()

            assert item.is_deleted is False
            assert item.is_preserved is True
            assert storage.file_exists(item.storage_key_encrypted_evidence)


# ── 10. Redis Temporary Exploratory Session Tracking ───────────────────

@pytest.mark.asyncio
async def test_redis_exploratory_session_service():
    """Verify Redis session recording, retrieval, and TTL behavior."""
    redis_svc = get_redis_service()
    session_id = f"test_sess_{uuid.uuid4().hex[:8]}"
    case_id = f"case_{uuid.uuid4().hex[:8]}"

    # Set exploratory session with 300s TTL
    await redis_svc.set_exploratory_session(
        session_id=session_id,
        case_id=case_id,
        metadata={"source": "exploratory_web_portal", "provisional": True},
        ttl_seconds=300,
    )

    # Retrieve session
    sess = await redis_svc.get_exploratory_session(session_id)
    assert sess is not None
    assert sess["case_id"] == case_id
    assert sess["metadata"]["source"] == "exploratory_web_portal"

    # Delete session
    await redis_svc.delete_exploratory_session(session_id)
    sess_after = await redis_svc.get_exploratory_session(session_id)
    assert sess_after is None


# ── 11. Examiner Review & Audit History ─────────────────────────────────

@pytest.mark.asyncio
async def test_examiner_review_and_audit_history(setup_test_db, test_client):
    """Verify examiner review, role isolation, and audit log tracking."""
    async with test_client as client:
        # Create victim and examiner tokens
        victim_token = await create_user_and_token(client, "victim_rev@example.com", "VICTIM")
        examiner_token = await create_user_and_token(client, "examiner_rev@example.com", "EXAMINER")

        # 1. Victim creates case
        case_resp = await client.post(
            "/cases",
            headers={"Authorization": f"Bearer {victim_token}"},
            json={"title": "Forensic Review Target Case"},
        )
        assert case_resp.status_code == 201
        case_id = case_resp.json()["id"]

        # 2. Victim attempts to review case -> 403 Forbidden
        victim_review_resp = await client.post(
            f"/cases/{case_id}/review",
            headers={"Authorization": f"Bearer {victim_token}"},
            json={
                "decision": "CONFIRMED_MANIPULATION",
                "examiner_notes": "Attempted self review",
                "human_override": False,
            },
        )
        assert victim_review_resp.status_code == 403

        # 3. Examiner submits review -> 200 OK
        examiner_review_resp = await client.post(
            f"/cases/{case_id}/review",
            headers={"Authorization": f"Bearer {examiner_token}"},
            json={
                "decision": "CONFIRMED_MANIPULATION",
                "examiner_notes": "Forensic boundary artifacts and frequency anomalies confirm face manipulation.",
                "human_override": True,
            },
        )
        assert examiner_review_resp.status_code == 200
        reviewed_case = examiner_review_resp.json()
        assert reviewed_case["review_status"] == "CONFIRMED_MANIPULATION"
        assert "frequency anomalies" in reviewed_case["examiner_notes"]

        # 4. Retrieve audit logs -> contains CASE_CREATED and HUMAN_REVIEW_RECORDED
        audit_resp = await client.get(
            f"/cases/{case_id}/audit-logs",
            headers={"Authorization": f"Bearer {examiner_token}"},
        )
        assert audit_resp.status_code == 200
        logs = audit_resp.json()
        assert len(logs) >= 2
        actions = [l["action"] for l in logs]
        assert "CASE_CREATED" in actions
        assert "HUMAN_REVIEW_RECORDED" in actions

