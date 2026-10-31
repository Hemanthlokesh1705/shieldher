"""
ShieldHer – Retention & Secure Deletion Service.

Implements:
- Temporary exploratory upload defaults (auto-expiring unless explicitly preserved).
- Documented explicit victim retention choices.
- Multi-pass cryptographic evidence shredding.
- Auditable deletion requests capturing cryptographic hash snapshots.

CRITICAL ETHICAL & FORENSIC SAFEGUARDS:
1. NEVER automatically delete an image merely because a detector labels it authentic:
   Genuine non-consensual intimate imagery (NCII) is frequently authentic and unmodified.
2. Exploratory uploads remain temporary by default.
3. Deletion requests preserve immutable cryptographic audit records without retaining image data.
"""
from __future__ import annotations

import datetime
from typing import Optional, Tuple
import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import structlog

from app.config import get_settings
from app.models.entities import (
    AuditLog,
    Case,
    CaseStatus,
    DeletionRequest,
    EvidenceItem,
    RetentionPolicy,
    User,
    UserRole,
)
from app.services.storage_service import ObjectStorageInterface, get_storage_service

logger = structlog.get_logger(__name__)


def _utc_now() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)


class RetentionService:
    def __init__(self, storage: Optional[ObjectStorageInterface] = None):
        self.settings = get_settings()
        self._storage = storage

    @property
    def storage(self) -> ObjectStorageInterface:
        if self._storage is not None:
            return self._storage
        return get_storage_service()

    # ── 1. Documented Retention Policy Update ──────────────────────────

    async def update_case_retention(
        self,
        session: AsyncSession,
        case: Case,
        user: User,
        new_policy: RetentionPolicy,
        retention_days: Optional[int] = None,
        reason: Optional[str] = None,
    ) -> Case:
        """
        Updates case retention policy under an explicit, documented victim choice.
        Preserves evidence only when PRESERVED_EVIDENCE is explicitly selected.
        """
        old_policy = case.retention_policy
        case.retention_policy = new_policy

        if new_policy == RetentionPolicy.PRESERVED_EVIDENCE:
            days = retention_days or self.settings.default_evidence_retention_days
            case.retention_expires_at = _utc_now() + datetime.timedelta(days=days)
            case.status = CaseStatus.EVIDENCE_PRESERVED
            # Mark all active evidence items as preserved
            for item in case.evidence_items:
                item.is_preserved = True
        elif new_policy == RetentionPolicy.TEMPORARY_EXPLORATORY:
            hours = self.settings.exploratory_retention_hours
            case.retention_expires_at = _utc_now() + datetime.timedelta(hours=hours)
            case.status = CaseStatus.OPEN
            for item in case.evidence_items:
                item.is_preserved = False

        audit = AuditLog(
            case_id=case.id,
            user_id=user.id,
            action="RETENTION_POLICY_CHANGED",
            details_json={
                "old_policy": old_policy.value,
                "new_policy": new_policy.value,
                "retention_expires_at": case.retention_expires_at.isoformat() if case.retention_expires_at else None,
                "reason": reason or "Explicit user retention selection",
            },
        )
        session.add(audit)
        await session.commit()
        await session.refresh(case)

        logger.info(
            "Case retention policy updated",
            case_id=str(case.id),
            policy=new_policy.value,
            user_id=str(user.id),
        )
        return case

    # ── 2. Secure Deletion Workflow ────────────────────────────────────

    async def secure_delete_evidence_item(
        self,
        session: AsyncSession,
        evidence: EvidenceItem,
        requested_by_user: User,
        reason: str,
    ) -> DeletionRequest:
        """
        Securely purges an individual evidence item:
        1. Records DeletionRequest with the original SHA-256 snapshot.
        2. Cryptographically shreds the encrypted original and derivative files.
        3. Clears storage keys and flags EvidenceItem.is_deleted = True.
        4. Writes an immutable audit entry.
        """
        case_id = evidence.case_id
        orig_hash = evidence.original_sha256

        # 1. Create DeletionRequest audit entity
        del_req = DeletionRequest(
            case_id=case_id,
            evidence_id=evidence.id,
            requested_by_user_id=requested_by_user.id,
            requester_role=requested_by_user.role.value,
            reason=reason,
            evidence_sha256_snapshot=orig_hash,
            status="PENDING",
            requested_at=_utc_now(),
        )
        session.add(del_req)
        await session.flush()

        # 2. Multi-pass cryptographic file shredding
        shredded_keys = []
        if evidence.storage_key_encrypted_evidence:
            self.storage.secure_shred_file(evidence.storage_key_encrypted_evidence)
            shredded_keys.append(evidence.storage_key_encrypted_evidence)
            evidence.storage_key_encrypted_evidence = None

        if evidence.storage_key_derivatives:
            self.storage.secure_shred_file(evidence.storage_key_derivatives)
            shredded_keys.append(evidence.storage_key_derivatives)
            evidence.storage_key_derivatives = None

        # 3. Mark evidence as deleted
        evidence.is_deleted = True
        evidence.deleted_at = _utc_now()
        del_req.status = "COMPLETED"
        del_req.completed_at = _utc_now()
        del_req.notes = f"Cryptographically shredded {len(shredded_keys)} files."

        # 4. Immutable AuditLog entry
        audit = AuditLog(
            case_id=case_id,
            user_id=requested_by_user.id,
            action="EVIDENCE_SECURELY_PURGED",
            details_json={
                "evidence_id": str(evidence.id),
                "original_sha256": orig_hash,
                "reason": reason,
                "shredded_keys": shredded_keys,
            },
        )
        session.add(audit)
        await session.commit()
        await session.refresh(del_req)

        logger.info(
            "Evidence securely purged",
            evidence_id=str(evidence.id),
            case_id=str(case_id),
            requested_by=str(requested_by_user.id),
        )
        return del_req

    async def secure_delete_entire_case(
        self,
        session: AsyncSession,
        case: Case,
        requested_by_user: User,
        reason: str,
    ) -> DeletionRequest:
        """
        Securely purges all evidence items and forensic reports for a case,
        marking the case as PURGED while preserving immutable audit logs.
        """
        # Purge all evidence items
        for ev in case.evidence_items:
            if not ev.is_deleted:
                if ev.storage_key_encrypted_evidence:
                    self.storage.secure_shred_file(ev.storage_key_encrypted_evidence)
                    ev.storage_key_encrypted_evidence = None
                if ev.storage_key_derivatives:
                    self.storage.secure_shred_file(ev.storage_key_derivatives)
                    ev.storage_key_derivatives = None
                if ev.storage_key_forensic_report:
                    self.storage.delete_file(ev.storage_key_forensic_report)
                    ev.storage_key_forensic_report = None
                ev.is_deleted = True
                ev.deleted_at = _utc_now()

        case.status = CaseStatus.PURGED
        case.retention_policy = RetentionPolicy.PURGED

        del_req = DeletionRequest(
            case_id=case.id,
            requested_by_user_id=requested_by_user.id,
            requester_role=requested_by_user.role.value,
            reason=reason,
            evidence_sha256_snapshot="CASE_WIDE_PURGE",
            status="COMPLETED",
            requested_at=_utc_now(),
            completed_at=_utc_now(),
            notes="All associated evidence items and reports cryptographically purged.",
        )
        session.add(del_req)

        audit = AuditLog(
            case_id=case.id,
            user_id=requested_by_user.id,
            action="CASE_WIDE_PURGE_COMPLETED",
            details_json={
                "case_id": str(case.id),
                "case_number": case.case_number,
                "reason": reason,
            },
        )
        session.add(audit)
        await session.commit()
        await session.refresh(del_req)
        return del_req


_retention_service: Optional[RetentionService] = None


def get_retention_service() -> RetentionService:
    global _retention_service
    if _retention_service is None:
        _retention_service = RetentionService()
    return _retention_service
