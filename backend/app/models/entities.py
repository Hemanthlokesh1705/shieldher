"""
ShieldHer – SQLAlchemy ORM Entity Models for Secure Case Persistence.

Entities:
- User (Role-Based Access Control: VICTIM, EXAMINER, ADVOCATE, ADMIN)
- Case (Case metadata, incident details, retention policy)
- EvidenceItem (Encrypted evidence reference, custody hash, separate forensic reports)
- ModelOutput (Independent detector scores, versions, checkpoint identifiers)
- EvidenceManifestEntry (Immutable evidentiary audit record)
- DeletionRequest (Auditable secure deletion requests)
- AuditLog (Immutable security and workflow audit trail)

CRITICAL SECURITY RULES:
- Sensitive image bytes are NEVER stored in database columns.
- Stored evidence is encrypted at rest and referenced via UUID storage keys.
- Deletion requests preserve cryptographic hashes without retaining image bytes.
"""
from __future__ import annotations

import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
import uuid

import sqlalchemy as sa
from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _utc_now() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)


class UserRole(str, Enum):
    VICTIM = "VICTIM"          # Case creator and primary evidence owner
    EXAMINER = "EXAMINER"      # Forensic examiner (can review & annotate cases)
    ADVOCATE = "ADVOCATE"      # Victim advocate / legal support
    ADMIN = "ADMIN"            # System administrator


class CaseStatus(str, Enum):
    OPEN = "OPEN"
    UNDER_REVIEW = "UNDER_REVIEW"
    EVIDENCE_PRESERVED = "EVIDENCE_PRESERVED"
    CLOSED = "CLOSED"
    PURGED = "PURGED"


class RetentionPolicy(str, Enum):
    TEMPORARY_EXPLORATORY = "TEMPORARY_EXPLORATORY"  # Default (24h auto-expire)
    PRESERVED_EVIDENCE = "PRESERVED_EVIDENCE"        # Documented victim preservation choice
    PURGED = "PURGED"                                # Securely wiped


# ── 1. User & Access Control ───────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    role: Mapped[UserRole] = mapped_column(
        sa.Enum(UserRole, name="user_role_enum", native_enum=False),
        default=UserRole.VICTIM,
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), default=_utc_now, nullable=False)
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), default=_utc_now, onupdate=_utc_now, nullable=False
    )

    cases: Mapped[List["Case"]] = relationship("Case", back_populates="owner", cascade="all, delete-orphan")


# ── 2. Case Metadata ───────────────────────────────────────────────────

class Case(Base):
    __tablename__ = "cases"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    case_number: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    incident_description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    incident_date: Mapped[Optional[datetime.date]] = mapped_column(sa.Date, nullable=True)
    platform_observed: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    status: Mapped[CaseStatus] = mapped_column(
        sa.Enum(CaseStatus, name="case_status_enum", native_enum=False),
        default=CaseStatus.OPEN,
        nullable=False,
    )
    retention_policy: Mapped[RetentionPolicy] = mapped_column(
        sa.Enum(RetentionPolicy, name="retention_policy_enum", native_enum=False),
        default=RetentionPolicy.TEMPORARY_EXPLORATORY,
        nullable=False,
    )
    retention_expires_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    review_status: Mapped[str] = mapped_column(String(64), default="UNREVIEWED", nullable=False)
    examiner_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    elicited_answers: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, default=dict, nullable=True)
    complaint_draft: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    escalation_status: Mapped[str] = mapped_column(String(64), default="DRAFT_LOCAL_ONLY", nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), default=_utc_now, nullable=False)
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), default=_utc_now, onupdate=_utc_now, nullable=False
    )

    owner: Mapped["User"] = relationship("User", back_populates="cases")
    evidence_items: Mapped[List["EvidenceItem"]] = relationship("EvidenceItem", back_populates="case", cascade="all, delete-orphan")
    manifest_entries: Mapped[List["EvidenceManifestEntry"]] = relationship("EvidenceManifestEntry", back_populates="case", cascade="all, delete-orphan")
    deletion_requests: Mapped[List["DeletionRequest"]] = relationship("DeletionRequest", back_populates="case", cascade="all, delete-orphan")
    reverse_searches: Mapped[List["ReverseSearchResult"]] = relationship("ReverseSearchResult", back_populates="case", cascade="all, delete-orphan")


# ── 3. Evidence Items (Encrypted Reference & Storage Separation) ───────

class EvidenceItem(Base):
    __tablename__ = "evidence_items"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    case_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("cases.id", ondelete="CASCADE"), nullable=False, index=True)
    filename_sanitized: Mapped[str] = mapped_column(String(255), nullable=False)
    original_sha256: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    mime_type: Mapped[str] = mapped_column(String(64), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)

    # Storage references: sensitive bytes are NEVER stored in the database!
    storage_key_encrypted_evidence: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    storage_key_derivatives: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    # Forensic reports are kept strictly separate from raw imagery
    storage_key_forensic_report: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # AES-256-GCM unique 96-bit initialization vector in hex
    encryption_iv_hex: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    is_preserved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    deleted_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    model_versions: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), default=_utc_now, nullable=False)
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), default=_utc_now, onupdate=_utc_now, nullable=False
    )

    case: Mapped["Case"] = relationship("Case", back_populates="evidence_items")
    model_outputs: Mapped[List["ModelOutput"]] = relationship("ModelOutput", back_populates="evidence", cascade="all, delete-orphan")
    reverse_searches: Mapped[List["ReverseSearchResult"]] = relationship("ReverseSearchResult", back_populates="evidence", cascade="all, delete-orphan")


# ── 4. Model Outputs ───────────────────────────────────────────────────

class ModelOutput(Base):
    __tablename__ = "model_outputs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    evidence_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("evidence_items.id", ondelete="CASCADE"), nullable=False, index=True)
    case_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("cases.id", ondelete="CASCADE"), nullable=False, index=True)
    detector_name: Mapped[str] = mapped_column(String(128), nullable=False)
    model_version: Mapped[str] = mapped_column(String(64), nullable=False)
    checkpoint_identifier: Mapped[str] = mapped_column(String(128), nullable=False)
    status: Mapped[str] = mapped_column(String(64), nullable=False)
    raw_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    predicted_label: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    score_semantics: Mapped[str] = mapped_column(Text, nullable=False)
    execution_duration_ms: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    details_json: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), default=_utc_now, nullable=False)

    evidence: Mapped["EvidenceItem"] = relationship("EvidenceItem", back_populates="model_outputs")


# ── 5. Evidence Manifest Entries ───────────────────────────────────────

class EvidenceManifestEntry(Base):
    __tablename__ = "evidence_manifest_entries"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    case_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("cases.id", ondelete="CASCADE"), nullable=False, index=True)
    evidence_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("evidence_items.id", ondelete="CASCADE"), nullable=False, index=True)
    manifest_sha256: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    manifest_data: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), default=_utc_now, nullable=False)

    case: Mapped["Case"] = relationship("Case", back_populates="manifest_entries")


# ── 6. Auditable Deletion Requests ─────────────────────────────────────

class DeletionRequest(Base):
    __tablename__ = "deletion_requests"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    case_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("cases.id", ondelete="CASCADE"), nullable=False, index=True)
    evidence_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid, nullable=True)
    requested_by_user_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    requester_role: Mapped[str] = mapped_column(String(64), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    # Cryptographic snapshot of the evidence hash being purged (preserves audit integrity without image data)
    evidence_sha256_snapshot: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="COMPLETED", nullable=False)
    requested_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), default=_utc_now, nullable=False)
    completed_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    case: Mapped["Case"] = relationship("Case", back_populates="deletion_requests")


# ── 7. Audit Log ───────────────────────────────────────────────────────

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    case_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid, nullable=True, index=True)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid, nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    details_json: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), default=_utc_now, nullable=False)


# ── 8. Reverse Image Search Results ────────────────────────────────────

class ReverseSearchResult(Base):
    __tablename__ = "reverse_search_results"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    case_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("cases.id", ondelete="CASCADE"), nullable=False, index=True)
    evidence_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("evidence_items.id", ondelete="CASCADE"), nullable=False, index=True)
    requested_by_user_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, index=True)
    provider: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    query_image_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    query_phash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    exact_matches_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    visual_matches_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    exact_matches: Mapped[List[Dict[str, Any]]] = mapped_column(JSON, default=list, nullable=False)
    visual_matches: Mapped[List[Dict[str, Any]]] = mapped_column(JSON, default=list, nullable=False)
    returned_urls: Mapped[List[str]] = mapped_column(JSON, default=list, nullable=False)
    search_duration_ms: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    consent_confirmed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    consent_timestamp: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    disclaimer: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), default=_utc_now, nullable=False)

    case: Mapped["Case"] = relationship("Case", back_populates="reverse_searches")
    evidence: Mapped["EvidenceItem"] = relationship("EvidenceItem", back_populates="reverse_searches")
