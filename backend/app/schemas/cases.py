"""
ShieldHer – Pydantic Schemas for Case Persistence, Evidence, RBAC, and Retention.
"""
from __future__ import annotations

import datetime
from typing import Any, Dict, List, Optional
import uuid
from pydantic import BaseModel, EmailStr, Field

from app.models.entities import CaseStatus, RetentionPolicy, UserRole


# ── Auth Schemas ───────────────────────────────────────────────────────

class UserRegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, description="Password (minimum 8 characters)")
    full_name: Optional[str] = None
    role: UserRole = Field(default=UserRole.VICTIM)


class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str


class FirebaseLoginRequest(BaseModel):
    id_token: Optional[str] = None
    email: EmailStr
    full_name: Optional[str] = None
    role: UserRole = Field(default=UserRole.VICTIM)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in_minutes: int
    user_id: str
    email: str
    role: str


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: Optional[str] = None
    role: UserRole
    is_active: bool
    created_at: datetime.datetime


# ── Case Schemas ───────────────────────────────────────────────────────

class CaseCreateRequest(BaseModel):
    title: str = Field(max_length=255)
    incident_description: Optional[str] = None
    incident_date: Optional[datetime.date] = None
    platform_observed: Optional[str] = None
    # Exploratory temporary upload is default; preserved evidence requires explicit choice
    retention_policy: RetentionPolicy = Field(default=RetentionPolicy.TEMPORARY_EXPLORATORY)
    retention_days: Optional[int] = Field(default=None, description="Days to retain if PRESERVED_EVIDENCE")


class CaseUpdateRequest(BaseModel):
    title: Optional[str] = None
    incident_description: Optional[str] = None
    incident_date: Optional[datetime.date] = None
    platform_observed: Optional[str] = None
    examiner_notes: Optional[str] = None


class RetentionUpdateRequest(BaseModel):
    retention_policy: RetentionPolicy
    retention_days: Optional[int] = None
    reason: str = Field(description="Documented justification for retention policy change")


class ModelOutputResponse(BaseModel):
    id: str
    detector_name: str
    model_version: str
    checkpoint_identifier: str
    status: str
    raw_score: Optional[float] = None
    predicted_label: Optional[str] = None
    score_semantics: str
    execution_duration_ms: Optional[float] = None
    created_at: datetime.datetime


class EvidenceItemResponse(BaseModel):
    id: str
    case_id: str
    filename_sanitized: str
    original_sha256: str
    mime_type: str
    file_size_bytes: int
    is_preserved: bool
    is_deleted: bool
    created_at: datetime.datetime
    model_outputs: List[ModelOutputResponse] = Field(default_factory=list)


class CaseResponse(BaseModel):
    id: str
    case_number: str
    user_id: str
    title: str
    incident_description: Optional[str] = None
    incident_date: Optional[datetime.date] = None
    platform_observed: Optional[str] = None
    status: CaseStatus
    retention_policy: RetentionPolicy
    retention_expires_at: Optional[datetime.datetime] = None
    review_status: str
    examiner_notes: Optional[str] = None
    created_at: datetime.datetime
    evidence_count: int = 0
    evidence_items: List[EvidenceItemResponse] = Field(default_factory=list)


# ── Secure Deletion & Download Schemas ─────────────────────────────────

class SecureDeleteRequest(BaseModel):
    reason: str = Field(min_length=5, description="Documented justification for secure evidence purge")


class DeletionRequestResponse(BaseModel):
    id: str
    case_id: str
    evidence_id: Optional[str] = None
    requested_by_user_id: str
    requester_role: str
    reason: str
    evidence_sha256_snapshot: str
    status: str
    requested_at: datetime.datetime
    completed_at: Optional[datetime.datetime] = None
    notes: Optional[str] = None


class DownloadUrlResponse(BaseModel):
    evidence_id: str
    download_url: str
    expires_at_utc: datetime.datetime
    expires_in_seconds: int


# ── Reviewer & Audit Schemas ──────────────────────────────────────────

class CaseReviewRequest(BaseModel):
    decision: str = Field(min_length=2, description="Review decision (e.g. CONFIRMED_MANIPULATION, AUTHENTIC, INCONCLUSIVE, TAMPERING_EVIDENT)")
    examiner_notes: str = Field(min_length=3, description="Examiner observations and forensic annotations")
    human_override: bool = Field(default=False, description="Flag indicating human examiner overrode automated model heuristics")


class AuditLogResponse(BaseModel):
    id: str
    case_id: Optional[str] = None
    user_id: Optional[str] = None
    action: str
    details_json: Optional[Dict[str, Any]] = None
    created_at: datetime.datetime

