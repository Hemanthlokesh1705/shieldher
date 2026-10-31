"""
ShieldHer – Cases & Evidence Persistence API Endpoints (/cases).

Implements:
- Case CRUD with strict ownership verification.
- Evidence upload with AES-256-GCM encryption at rest.
- Separation of raw imagery and forensic reports.
- Short-lived signed download URLs.
- Auditable secure deletion and retention choice workflows.
- Safeguards against decompression bombs, path traversal, and malicious uploads.
"""
from __future__ import annotations

import datetime
import io
from pathlib import Path
from typing import Any, Dict, List, Optional
import uuid

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Header,
    HTTPException,
    Query,
    Request,
    Response,
    UploadFile,
    status,
)
from fastapi.responses import StreamingResponse
from PIL import Image
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
import structlog

from app.config import get_settings
from app.database import get_db_session
from app.models.entities import (
    AuditLog,
    Case,
    CaseStatus,
    DeletionRequest,
    EvidenceItem,
    EvidenceManifestEntry,
    ModelOutput,
    RetentionPolicy,
    User,
    UserRole,
)
from app.schemas.cases import (
    AuditLogResponse,
    CaseCreateRequest,
    CaseResponse,
    CaseReviewRequest,
    CaseUpdateRequest,
    DeletionRequestResponse,
    DownloadUrlResponse,
    EvidenceItemResponse,
    ModelOutputResponse,
    RetentionUpdateRequest,
    SecureDeleteRequest,
)
from app.services.auth_service import (
    check_case_ownership_or_permission,
    get_current_user,
    get_optional_current_user,
    require_roles,
)
from app.services.crypto_service import CryptoService, get_crypto_service
from app.services.forensic_service import get_forensic_service
from app.services.image_processor import get_image_processor
from app.services.retention_service import RetentionService, get_retention_service
from app.services.storage_service import ObjectStorageInterface, get_storage_service
from app.workflows.workflow import shieldher_workflow

router = APIRouter(prefix="/cases", tags=["cases"])
logger = structlog.get_logger(__name__)


def _utc_now() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)


async def _get_or_create_exploratory_user() -> User:
    """Helper to retrieve or auto-provision an exploratory guest user for unauthenticated intake."""
    async with get_db_session() as session:
        guest_email = "guest_exploratory@shieldher.org"
        res = await session.execute(select(User).where(User.email == guest_email))
        user = res.scalar_one_or_none()
        if not user:
            crypto = get_crypto_service()
            user = User(
                email=guest_email,
                hashed_password=crypto.hash_password("ExploratoryGuest_2026_Secure!"),
                full_name="Exploratory Intake User",
                role=UserRole.VICTIM,
                is_active=True,
            )
            session.add(user)
            await session.commit()
            await session.refresh(user)
        return user


def _format_case_response(case: Case) -> CaseResponse:
    evidence_list: List[EvidenceItemResponse] = []
    for item in case.evidence_items:
        outputs = [
            ModelOutputResponse(
                id=str(mo.id),
                detector_name=mo.detector_name,
                model_version=mo.model_version,
                checkpoint_identifier=mo.checkpoint_identifier,
                status=mo.status,
                raw_score=mo.raw_score,
                predicted_label=mo.predicted_label,
                score_semantics=mo.score_semantics,
                execution_duration_ms=mo.execution_duration_ms,
                created_at=mo.created_at,
            )
            for mo in item.model_outputs
        ]
        evidence_list.append(
            EvidenceItemResponse(
                id=str(item.id),
                case_id=str(item.case_id),
                filename_sanitized=item.filename_sanitized,
                original_sha256=item.original_sha256,
                mime_type=item.mime_type,
                file_size_bytes=item.file_size_bytes,
                is_preserved=item.is_preserved,
                is_deleted=item.is_deleted,
                created_at=item.created_at,
                model_outputs=outputs,
            )
        )

    return CaseResponse(
        id=str(case.id),
        case_number=case.case_number,
        user_id=str(case.user_id),
        title=case.title,
        incident_description=case.incident_description,
        incident_date=case.incident_date,
        platform_observed=case.platform_observed,
        status=case.status,
        retention_policy=case.retention_policy,
        retention_expires_at=case.retention_expires_at,
        review_status=case.review_status,
        examiner_notes=case.examiner_notes,
        created_at=case.created_at,
        evidence_count=len(evidence_list),
        evidence_items=evidence_list,
    )


# ── 1. Create Case ─────────────────────────────────────────────────────

@router.post(
    "",
    response_model=CaseResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new case with temporary exploratory retention by default",
)
async def create_case(
    req: CaseCreateRequest,
    current_user: Optional[User] = Depends(get_optional_current_user),
) -> CaseResponse:
    if current_user is None:
        current_user = await _get_or_create_exploratory_user()

    settings = get_settings()
    case_num = f"SH-{datetime.date.today().strftime('%Y%m')}-{uuid.uuid4().hex[:8].upper()}"

    # Calculate initial expiration based on retention policy
    if req.retention_policy == RetentionPolicy.PRESERVED_EVIDENCE:
        days = req.retention_days or settings.default_evidence_retention_days
        expires_at = _utc_now() + datetime.timedelta(days=days)
        initial_status = CaseStatus.EVIDENCE_PRESERVED
    else:
        # Default is temporary exploratory
        hours = settings.exploratory_retention_hours
        expires_at = _utc_now() + datetime.timedelta(hours=hours)
        initial_status = CaseStatus.OPEN

    async with get_db_session() as session:
        new_case = Case(
            case_number=case_num,
            user_id=current_user.id,
            title=req.title,
            incident_description=req.incident_description,
            incident_date=req.incident_date,
            platform_observed=req.platform_observed,
            status=initial_status,
            retention_policy=req.retention_policy,
            retention_expires_at=expires_at,
            review_status="UNREVIEWED",
        )
        session.add(new_case)
        await session.flush()

        audit = AuditLog(
            case_id=new_case.id,
            user_id=current_user.id,
            action="CASE_CREATED",
            details_json={
                "case_number": case_num,
                "retention_policy": req.retention_policy.value,
                "retention_expires_at": expires_at.isoformat(),
            },
        )
        session.add(audit)
        await session.commit()

        # Re-query with eager relationships
        q = select(Case).where(Case.id == new_case.id).options(
            selectinload(Case.evidence_items).selectinload(EvidenceItem.model_outputs)
        )
        res = await session.execute(q)
        case_loaded = res.scalar_one()

    logger.info("Created new case", case_number=case_num, owner=str(current_user.id))
    return _format_case_response(case_loaded)


# ── 2. List Cases ──────────────────────────────────────────────────────

@router.get(
    "",
    response_model=List[CaseResponse],
    summary="List cases (Victims view own cases; Examiners view assigned cases)",
)
async def list_cases(
    current_user: Optional[User] = Depends(get_optional_current_user),
) -> List[CaseResponse]:
    if not current_user:
        return []

    async with get_db_session() as session:
        q = select(Case).options(
            selectinload(Case.evidence_items).selectinload(EvidenceItem.model_outputs)
        ).order_by(Case.created_at.desc())

        # If victim, restrict to own cases
        if current_user.role == UserRole.VICTIM:
            q = q.where(Case.user_id == current_user.id)

        res = await session.execute(q)
        cases = res.scalars().all()

    return [_format_case_response(c) for c in cases]


# ── 3. Get Case Details ────────────────────────────────────────────────

@router.get(
    "/{case_id}",
    response_model=CaseResponse,
    summary="Get case details by ID",
)
async def get_case(
    case_id: uuid.UUID,
    current_user: Optional[User] = Depends(get_optional_current_user),
) -> CaseResponse:
    if current_user is None:
        current_user = await _get_or_create_exploratory_user()

    async with get_db_session() as session:
        q = select(Case).where(Case.id == case_id).options(
            selectinload(Case.evidence_items).selectinload(EvidenceItem.model_outputs)
        )
        res = await session.execute(q)
        case = res.scalar_one_or_none()

        if not case:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")

        check_case_ownership_or_permission(case, current_user, allow_examiners=True)

    return _format_case_response(case)


# ── 4. Update Retention Policy ─────────────────────────────────────────

@router.patch(
    "/{case_id}/retention",
    response_model=CaseResponse,
    summary="Update case retention policy with documented justification",
)
async def update_retention(
    case_id: uuid.UUID,
    req: RetentionUpdateRequest,
    current_user: User = Depends(get_current_user),
    retention_svc: RetentionService = Depends(get_retention_service),
) -> CaseResponse:
    async with get_db_session() as session:
        q = select(Case).where(Case.id == case_id).options(
            selectinload(Case.evidence_items).selectinload(EvidenceItem.model_outputs)
        )
        res = await session.execute(q)
        case = res.scalar_one_or_none()

        if not case:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")

        check_case_ownership_or_permission(case, current_user, allow_examiners=False)

        updated_case = await retention_svc.update_case_retention(
            session=session,
            case=case,
            user=current_user,
            new_policy=req.retention_policy,
            retention_days=req.retention_days,
            reason=req.reason,
        )

    return _format_case_response(updated_case)


# ── 5. Secure Evidence Upload & Encryption ─────────────────────────────

@router.post(
    "/{case_id}/evidence",
    response_model=EvidenceItemResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload and encrypt evidence item into case",
)
async def upload_evidence_to_case(
    case_id: uuid.UUID,
    file: UploadFile = File(..., description="Evidence image file"),
    content_length: Optional[int] = Header(None),
    current_user: Optional[User] = Depends(get_optional_current_user),
    crypto: CryptoService = Depends(get_crypto_service),
    storage: ObjectStorageInterface = Depends(get_storage_service),
) -> EvidenceItemResponse:
    if current_user is None:
        current_user = await _get_or_create_exploratory_user()

    settings = get_settings()

    # 1. Request size limit defense
    if content_length and content_length > settings.max_upload_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Upload exceeds maximum allowable size of {settings.max_upload_size_bytes} bytes",
        )

    raw_bytes = await file.read()
    if len(raw_bytes) > settings.max_upload_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File size exceeds maximum allowable limit",
        )

    # 2. Decompression bomb safeguard
    Image.MAX_IMAGE_PIXELS = settings.max_image_pixels

    # 3. Filename sanitization & path traversal prevention
    clean_filename = crypto.sanitize_filename(file.filename)

    # 4. Ingest via LangGraph Workflow
    initial_state = {
        "case_id": str(case_id),
        "session_id": f"sess_{uuid.uuid4().hex[:8]}",
        "raw_bytes": raw_bytes,
        "filename": clean_filename,
        "content_type": file.content_type,
        "consent_flags": {
            "consent_evidence_storage": True,
            "consent_forensic_processing": True,
            "consent_complaint_generation": True,
        },
        "include_forensics": True,
        "errors": [],
        "audit_events": [],
    }

    # Run LangGraph pipeline
    workflow_result = await shieldher_workflow.ainvoke(initial_state)

    orig_sha256 = workflow_result.get("image_hash") or ""
    evidence_id = uuid.uuid4()

    # 5. Encrypt raw evidence bytes using AES-256-GCM
    # Raw bytes are NEVER written to the database!
    encrypted_bytes, iv_hex = crypto.encrypt_evidence(raw_bytes)
    storage_key_enc = f"originals/{evidence_id}.enc"
    storage.save_file(storage_key_enc, encrypted_bytes)

    # 6. Save forensic report separately from raw imagery
    storage_key_forensics = f"forensics/{evidence_id}_report.json"
    report_content = workflow_result.get("forensic_results") or {
        "status": workflow_result.get("overall_status"),
        "explanation": workflow_result.get("explanation"),
        "evidence_manifest": workflow_result.get("evidence_manifest"),
        "quality_assessment": workflow_result.get("quality_assessment"),
        "face_manipulation_result": workflow_result.get("face_manipulation_result"),
        "ai_generation_result": workflow_result.get("ai_generation_result"),
    }
    storage.save_json(storage_key_forensics, report_content)

    # 7. Persist EvidenceItem and ModelOutputs to PostgreSQL
    async with get_db_session() as session:
        # Verify case ownership
        res = await session.execute(select(Case).where(Case.id == case_id))
        case = res.scalar_one_or_none()
        if not case:
            storage.delete_file(storage_key_enc)
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")

        check_case_ownership_or_permission(case, current_user, allow_examiners=False)

        is_preserved = (case.retention_policy == RetentionPolicy.PRESERVED_EVIDENCE)
        derivatives_path = workflow_result.get("storage_reference")

        item = EvidenceItem(
            id=evidence_id,
            case_id=case_id,
            filename_sanitized=clean_filename,
            original_sha256=orig_sha256,
            mime_type=file.content_type or "application/octet-stream",
            file_size_bytes=len(raw_bytes),
            storage_key_encrypted_evidence=storage_key_enc,
            storage_key_derivatives=derivatives_path,
            storage_key_forensic_report=storage_key_forensics,
            encryption_iv_hex=iv_hex,
            is_preserved=is_preserved,
            is_deleted=False,
            model_versions={
                "effort": "effort_clip_l14_faceforensics_pp_c23",
                "smaug": "abacusai/Smaug-AI-Image-Detector",
            },
        )
        session.add(item)
        await session.flush()

        # Add Effort model output
        effort_res = workflow_result.get("face_manipulation_result") or {}
        mo_effort = ModelOutput(
            evidence_id=item.id,
            case_id=case_id,
            detector_name="Effort-AIGI-Detection",
            model_version="CLIP-ViT-L/14-Residuals",
            checkpoint_identifier=effort_res.get("checkpoint_identifier", "effort_clip_l14_faceforensics_pp_c23"),
            status=effort_res.get("status", "UNAVAILABLE"),
            raw_score=effort_res.get("manipulation_score"),
            predicted_label=effort_res.get("predicted_label"),
            score_semantics=effort_res.get("score_semantics", "Unscaled heuristic score"),
            execution_duration_ms=effort_res.get("inference_duration_ms"),
            details_json=effort_res,
        )
        session.add(mo_effort)

        # Add Smaug model output
        smaug_res = workflow_result.get("ai_generation_result") or {}
        mo_smaug = ModelOutput(
            evidence_id=item.id,
            case_id=case_id,
            detector_name="Smaug-AI-Image-Detector",
            model_version="EmbeddingGemma-2-Vision",
            checkpoint_identifier=smaug_res.get("checkpoint_identifier", "abacusai/Smaug-AI-Image-Detector"),
            status=smaug_res.get("status", "UNAVAILABLE"),
            raw_score=smaug_res.get("ai_generation_score"),
            predicted_label=smaug_res.get("predicted_label"),
            score_semantics=smaug_res.get("score_semantics", "Unscaled heuristic score"),
            execution_duration_ms=smaug_res.get("inference_duration_ms"),
            details_json=smaug_res,
        )
        session.add(mo_smaug)

        # Add EvidenceManifestEntry
        manifest_data = workflow_result.get("evidence_manifest") or {}
        manifest_entry = EvidenceManifestEntry(
            case_id=case_id,
            evidence_id=item.id,
            manifest_sha256=orig_sha256,
            manifest_data=manifest_data,
        )
        session.add(manifest_entry)

        # AuditLog
        audit = AuditLog(
            case_id=case_id,
            user_id=current_user.id,
            action="EVIDENCE_ENCRYPTED_AND_STORED",
            details_json={
                "evidence_id": str(item.id),
                "original_sha256": orig_sha256,
                "storage_key": storage_key_enc,
                "is_preserved": is_preserved,
            },
        )
        session.add(audit)
        await session.commit()

        # Reload with relationships
        q = select(EvidenceItem).where(EvidenceItem.id == item.id).options(
            selectinload(EvidenceItem.model_outputs)
        )
        res = await session.execute(q)
        loaded_item = res.scalar_one()

    logger.info("Encrypted and stored evidence", evidence_id=str(item.id), case_id=str(case_id))
    outputs = [
        ModelOutputResponse(
            id=str(mo.id),
            detector_name=mo.detector_name,
            model_version=mo.model_version,
            checkpoint_identifier=mo.checkpoint_identifier,
            status=mo.status,
            raw_score=mo.raw_score,
            predicted_label=mo.predicted_label,
            score_semantics=mo.score_semantics,
            execution_duration_ms=mo.execution_duration_ms,
            created_at=mo.created_at,
        )
        for mo in loaded_item.model_outputs
    ]
    return EvidenceItemResponse(
        id=str(loaded_item.id),
        case_id=str(loaded_item.case_id),
        filename_sanitized=loaded_item.filename_sanitized,
        original_sha256=loaded_item.original_sha256,
        mime_type=loaded_item.mime_type,
        file_size_bytes=loaded_item.file_size_bytes,
        is_preserved=loaded_item.is_preserved,
        is_deleted=loaded_item.is_deleted,
        created_at=loaded_item.created_at,
        model_outputs=outputs,
    )


# ── 6. Short-Lived Signed Download URL ─────────────────────────────────

@router.get(
    "/{case_id}/evidence/{evidence_id}/download-url",
    response_model=DownloadUrlResponse,
    summary="Generate an authenticated, short-lived signed download URL",
)
async def get_evidence_download_url(
    case_id: uuid.UUID,
    evidence_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    crypto: CryptoService = Depends(get_crypto_service),
) -> DownloadUrlResponse:
    async with get_db_session() as session:
        res = await session.execute(
            select(EvidenceItem).join(Case).where(
                EvidenceItem.id == evidence_id,
                EvidenceItem.case_id == case_id,
            ).options(selectinload(EvidenceItem.case))
        )
        evidence = res.scalar_one_or_none()

        if not evidence:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Evidence item not found")

        if evidence.is_deleted:
            raise HTTPException(status_code=status.HTTP_410_GONE, detail="Evidence item has been securely purged")

        check_case_ownership_or_permission(evidence.case, current_user, allow_examiners=True)

        token, expires_at = crypto.generate_download_token(str(evidence.id), str(current_user.id))

        base_url = str(request.base_url).rstrip("/")
        download_url = f"{base_url}/cases/{case_id}/evidence/{evidence_id}/download?token={token}&uid={current_user.id}"

        # AuditLog
        audit = AuditLog(
            case_id=case_id,
            user_id=current_user.id,
            action="DOWNLOAD_URL_ISSUED",
            details_json={
                "evidence_id": str(evidence.id),
                "expires_at_epoch": expires_at,
            },
        )
        session.add(audit)
        await session.commit()

    return DownloadUrlResponse(
        evidence_id=str(evidence.id),
        download_url=download_url,
        expires_at_utc=datetime.datetime.fromtimestamp(expires_at, tz=datetime.timezone.utc),
        expires_in_seconds=crypto._download_ttl,
    )


# ── 7. Authenticated Download Execution ────────────────────────────────

@router.get(
    "/{case_id}/evidence/{evidence_id}/download",
    summary="Decrypt and download original evidence using signed token",
)
async def download_evidence(
    case_id: uuid.UUID,
    evidence_id: uuid.UUID,
    token: str = Query(..., description="Signed HMAC download token"),
    uid: str = Query(..., description="Requesting user UUID"),
    crypto: CryptoService = Depends(get_crypto_service),
    storage: ObjectStorageInterface = Depends(get_storage_service),
):
    # 1. Verify download signature
    if not crypto.verify_download_token(str(evidence_id), uid, token):
        logger.warning("Invalid or expired download token", evidence_id=str(evidence_id), uid=uid)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Download token is invalid or has expired.",
        )

    async with get_db_session() as session:
        res = await session.execute(
            select(EvidenceItem).where(
                EvidenceItem.id == evidence_id,
                EvidenceItem.case_id == case_id,
            )
        )
        evidence = res.scalar_one_or_none()

        if not evidence:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Evidence item not found")

        if evidence.is_deleted or not evidence.storage_key_encrypted_evidence:
            raise HTTPException(status_code=status.HTTP_410_GONE, detail="Evidence has been securely purged")

        # 2. Retrieve encrypted bytes from storage
        encrypted_bytes = storage.load_file(evidence.storage_key_encrypted_evidence)

        # 3. Decrypt at runtime using stored IV
        decrypted_bytes = crypto.decrypt_evidence(encrypted_bytes, evidence.encryption_iv_hex)

        # Audit download
        audit = AuditLog(
            case_id=case_id,
            user_id=uuid.UUID(uid),
            action="EVIDENCE_DOWNLOADED",
            details_json={"evidence_id": str(evidence_id)},
        )
        session.add(audit)
        await session.commit()

    return StreamingResponse(
        io.BytesIO(decrypted_bytes),
        media_type=evidence.mime_type,
        headers={
            "Content-Disposition": f'attachment; filename="{evidence.filename_sanitized}"',
            "Cache-Control": "no-store, no-cache, must-revalidate",
        },
    )


# ── 8. Secure Deletion ─────────────────────────────────────────────────

@router.delete(
    "/{case_id}/evidence/{evidence_id}",
    response_model=DeletionRequestResponse,
    summary="Securely purge evidence item with cryptographic shredding",
)
async def delete_evidence_item(
    case_id: uuid.UUID,
    evidence_id: uuid.UUID,
    req: SecureDeleteRequest,
    current_user: User = Depends(get_current_user),
    retention_svc: RetentionService = Depends(get_retention_service),
) -> DeletionRequestResponse:
    async with get_db_session() as session:
        res = await session.execute(
            select(EvidenceItem).join(Case).where(
                EvidenceItem.id == evidence_id,
                EvidenceItem.case_id == case_id,
            ).options(selectinload(EvidenceItem.case))
        )
        evidence = res.scalar_one_or_none()

        if not evidence:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Evidence item not found")

        check_case_ownership_or_permission(evidence.case, current_user, allow_examiners=False)

        del_req = await retention_svc.secure_delete_evidence_item(
            session=session,
            evidence=evidence,
            requested_by_user=current_user,
            reason=req.reason,
        )

    return DeletionRequestResponse(
        id=str(del_req.id),
        case_id=str(del_req.case_id),
        evidence_id=str(del_req.evidence_id) if del_req.evidence_id else None,
        requested_by_user_id=str(del_req.requested_by_user_id),
        requester_role=del_req.requester_role,
        reason=del_req.reason,
        evidence_sha256_snapshot=del_req.evidence_sha256_snapshot,
        status=del_req.status,
        requested_at=del_req.requested_at,
        completed_at=del_req.completed_at,
        notes=del_req.notes,
    )


@router.delete(
    "/{case_id}",
    response_model=DeletionRequestResponse,
    summary="Securely purge entire case and all associated evidence files",
)
async def delete_case(
    case_id: uuid.UUID,
    req: SecureDeleteRequest,
    current_user: User = Depends(get_current_user),
    retention_svc: RetentionService = Depends(get_retention_service),
) -> DeletionRequestResponse:
    async with get_db_session() as session:
        res = await session.execute(
            select(Case).where(Case.id == case_id).options(selectinload(Case.evidence_items))
        )
        case = res.scalar_one_or_none()

        if not case:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")

        check_case_ownership_or_permission(case, current_user, allow_examiners=False)

        del_req = await retention_svc.secure_delete_entire_case(
            session=session,
            case=case,
            requested_by_user=current_user,
            reason=req.reason,
        )

    return DeletionRequestResponse(
        id=str(del_req.id),
        case_id=str(del_req.case_id),
        evidence_id=None,
        requested_by_user_id=str(del_req.requested_by_user_id),
        requester_role=del_req.requester_role,
        reason=del_req.reason,
        evidence_sha256_snapshot=del_req.evidence_sha256_snapshot,
        status=del_req.status,
        requested_at=del_req.requested_at,
        completed_at=del_req.completed_at,
        notes=del_req.notes,
    )


# ── 9. Reviewer Annotations & Human Override ──────────────────────────

@router.post(
    "/{case_id}/review",
    response_model=CaseResponse,
    summary="Record human examiner review decision and override notes",
)
async def review_case(
    case_id: uuid.UUID,
    req: CaseReviewRequest,
    current_user: User = Depends(require_roles(UserRole.EXAMINER, UserRole.ADVOCATE, UserRole.ADMIN)),
) -> CaseResponse:
    async with get_db_session() as session:
        res = await session.execute(
            select(Case).where(Case.id == case_id).options(
                selectinload(Case.evidence_items).selectinload(EvidenceItem.model_outputs)
            )
        )
        case = res.scalar_one_or_none()

        if not case:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")

        case.review_status = req.decision
        case.examiner_notes = req.examiner_notes
        case.updated_at = _utc_now()

        audit = AuditLog(
            case_id=case.id,
            user_id=current_user.id,
            action="HUMAN_REVIEW_RECORDED",
            details_json={
                "decision": req.decision,
                "examiner_notes": req.examiner_notes,
                "human_override": req.human_override,
                "reviewed_by": current_user.email,
                "reviewer_role": current_user.role.value,
            },
        )
        session.add(audit)
        await session.commit()
        await session.refresh(case)

    logger.info(
        "Recorded examiner review on case",
        case_id=str(case_id),
        decision=req.decision,
        reviewer=current_user.email,
    )
    return _format_case_response(case)


# ── 10. Case Audit History ─────────────────────────────────────────────

@router.get(
    "/{case_id}/audit-logs",
    response_model=List[AuditLogResponse],
    summary="Retrieve immutable audit history for a case",
)
async def get_case_audit_logs(
    case_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
) -> List[AuditLogResponse]:
    async with get_db_session() as session:
        res = await session.execute(select(Case).where(Case.id == case_id))
        case = res.scalar_one_or_none()

        if not case:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")

        check_case_ownership_or_permission(case, current_user, allow_examiners=True)

        logs_res = await session.execute(
            select(AuditLog).where(AuditLog.case_id == case_id).order_by(AuditLog.created_at.desc())
        )
        logs = logs_res.scalars().all()

    return [
        AuditLogResponse(
            id=str(log.id),
            case_id=str(log.case_id) if log.case_id else None,
            user_id=str(log.user_id) if log.user_id else None,
            action=log.action,
            details_json=log.details_json,
            created_at=log.created_at,
        )
        for log in logs
    ]

