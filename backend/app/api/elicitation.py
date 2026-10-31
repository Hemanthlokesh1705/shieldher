"""
ShieldHer – Elicitation and Escalation API Endpoints.

ROUTERS:
- POST /elicit: Submit answers for questionnaire round and advance to next round
- GET  /elicit: Retrieve questions for current/specified questionnaire round
- POST /escalate: Finalize downloadable legal draft with recorded user confirmation
- GET  /cases/{case_id}/draft: Retrieve existing draft complaint
- POST /cases/{case_id}/elicit: Case-scoped elicitation submission
- POST /cases/{case_id}/escalate: Case-scoped escalation submission

SAFETY CONSTRAINTS:
1. POST /escalate NEVER submits complaints to any external agency, portal, or police.
2. Requires explicit, recorded user confirmation that the draft was reviewed.
3. Every question can be skipped; deterministic fallback templates are always available.
"""
from __future__ import annotations

import datetime
from typing import Any, Dict, List, Optional
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import selectinload
import structlog

from app.database import get_db_session
from app.models.entities import AuditLog, Case, EvidenceItem, User
from app.schemas.complaint import (
    ComplaintDraftRequest,
    ComplaintDraftResponse,
    ElicitationRoundResponse,
    ElicitationSubmission,
    EscalateConfirmationRequest,
    EscalateResponse,
)
from app.services.auth_service import check_case_ownership_or_permission, get_current_user
from app.services.elicitation_service import ElicitationService, get_elicitation_service
from app.workflows.complaint_graph import complaint_drafting_workflow

logger = structlog.get_logger(__name__)

router = APIRouter(tags=["Victim Support: Elicitation & Escalation"])


def _utc_now() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)


class ElicitPostPayload(BaseModel):
    case_id: uuid.UUID
    round_number: int = Field(..., ge=1, le=3)
    answers: Dict[str, Any] = Field(default_factory=dict)
    skipped_question_ids: List[str] = Field(default_factory=list)


class EscalatePostPayload(BaseModel):
    case_id: uuid.UUID
    acknowledged_draft_reviewed: bool = Field(
        ...,
        description="Must be True: affirmative confirmation that user reviewed the draft complaint",
    )
    include_technical_forensics: bool = True
    include_intermediary_takedown_notice: bool = True
    use_llm_if_available: bool = True
    confirmation_notes: Optional[str] = None


# ── 1. POST /elicit ────────────────────────────────────────────────────

@router.post(
    "/elicit",
    response_model=ElicitationRoundResponse,
    summary="Submit answers for questionnaire round and retrieve next round",
)
async def submit_elicitation_round(
    payload: ElicitPostPayload,
    current_user: User = Depends(get_current_user),
    elicit_svc: ElicitationService = Depends(get_elicitation_service),
) -> ElicitationRoundResponse:
    async with get_db_session() as session:
        res = await session.execute(
            select(Case).where(Case.id == payload.case_id)
        )
        case = res.scalar_one_or_none()
        if not case:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")

        check_case_ownership_or_permission(case, current_user, allow_examiners=False)

        # Merge new answers into existing case answers
        submission = ElicitationSubmission(
            round_number=payload.round_number,
            answers=payload.answers,
            skipped_question_ids=payload.skipped_question_ids,
        )
        merged = elicit_svc.merge_answers(case.elicited_answers, submission)
        case.elicited_answers = merged

        # Also populate case incident metadata fields if provided
        if "q1_platform" in payload.answers and payload.answers["q1_platform"]:
            case.platform_observed = str(payload.answers["q1_platform"])[:128]

        # Audit elicitation submission
        audit = AuditLog(
            case_id=case.id,
            user_id=current_user.id,
            action="ELICITATION_ROUND_COMPLETED",
            details_json={
                "round_submitted": payload.round_number,
                "answers_count": len(payload.answers),
                "skipped_count": len(payload.skipped_question_ids),
            },
        )
        session.add(audit)
        await session.commit()

        # Advance to next round (or return round 3 completion)
        next_round = min(3, payload.round_number + 1) if payload.round_number < 3 else 3
        return elicit_svc.get_round_questions(next_round, str(case.id), merged)


# ── 2. GET /elicit ─────────────────────────────────────────────────────

@router.get(
    "/elicit",
    response_model=ElicitationRoundResponse,
    summary="Retrieve questionnaire questions for a round",
)
async def get_elicitation_round(
    case_id: uuid.UUID = Query(..., description="Target case UUID"),
    round_number: int = Query(1, ge=1, le=3, description="Requested round number (1, 2, or 3)"),
    current_user: User = Depends(get_current_user),
    elicit_svc: ElicitationService = Depends(get_elicitation_service),
) -> ElicitationRoundResponse:
    async with get_db_session() as session:
        res = await session.execute(select(Case).where(Case.id == case_id))
        case = res.scalar_one_or_none()
        if not case:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")

        check_case_ownership_or_permission(case, current_user, allow_examiners=True)
        return elicit_svc.get_round_questions(round_number, str(case.id), case.elicited_answers)


# ── 3. POST /escalate ──────────────────────────────────────────────────

@router.post(
    "/escalate",
    response_model=EscalateResponse,
    summary="Finalize and generate downloadable complaint draft and reporting guidance",
)
async def escalate_and_generate_draft(
    payload: EscalatePostPayload,
    current_user: User = Depends(get_current_user),
) -> EscalateResponse:
    """
    Finalizes legal complaint draft and emergency takedown notice.
    CRITICAL: Does NOT submit anything to any external party or police portal.
    """
    # 1. Require explicit, recorded user confirmation
    if not payload.acknowledged_draft_reviewed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Affirmative user confirmation is required acknowledging draft review prior to finalization.",
        )

    async with get_db_session() as session:
        res = await session.execute(
            select(Case)
            .where(Case.id == payload.case_id)
            .options(
                selectinload(Case.evidence_items).selectinload(EvidenceItem.model_outputs)
            )
        )
        case = res.scalar_one_or_none()
        if not case:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")

        check_case_ownership_or_permission(case, current_user, allow_examiners=False)

        # 2. Gather evidence metadata
        evidence_records: List[Dict[str, Any]] = []
        for ev in case.evidence_items:
            if not ev.is_deleted:
                findings: Dict[str, Any] = {}
                for mo in ev.model_outputs:
                    if "effort" in mo.detector_name.lower():
                        findings["effort"] = {"score": mo.raw_score, "label": mo.predicted_label}
                    elif "smaug" in mo.detector_name.lower():
                        findings["smaug"] = {"score": mo.raw_score, "label": mo.predicted_label}

                evidence_records.append({
                    "id": str(ev.id),
                    "filename_sanitized": ev.filename_sanitized,
                    "original_sha256": ev.original_sha256,
                    "file_size_bytes": ev.file_size_bytes,
                    "mime_type": ev.mime_type,
                    "model_findings": findings,
                })

        user_facts = case.elicited_answers or {}

        # 3. Execute LangGraph complaint drafting workflow
        workflow_input = {
            "case_id": str(case.id),
            "case_number": case.case_number,
            "user_answers": user_facts,
            "raw_evidence_records": evidence_records,
            "use_llm": payload.use_llm_if_available,
            "applicable_provisions": [],
            "reporting_guidance": {},
            "evidence_index": [],
            "draft_response": None,
            "errors": [],
            "audit_events": [],
        }

        final_state = await complaint_drafting_workflow.ainvoke(workflow_input)
        draft_dict = final_state.get("draft_response") or {}

        # 4. Record user confirmation & update Case record
        confirmation_record = {
            "confirmed_by_user_id": str(current_user.id),
            "confirmed_at": _utc_now().isoformat(),
            "notes": payload.confirmation_notes,
            "acknowledged_draft_reviewed": True,
        }

        case.complaint_draft = draft_dict
        case.escalation_status = "FINALIZED_LOCAL_DRAFT"

        # 5. Immutable audit log
        audit = AuditLog(
            case_id=case.id,
            user_id=current_user.id,
            action="COMPLAINT_DRAFT_FINALIZED_FOR_DOWNLOAD",
            details_json={
                "case_number": case.case_number,
                "drafting_method": draft_dict.get("drafting_method"),
                "confirmation": confirmation_record,
                "submission_status": "NOT_SUBMITTED_LOCAL_DRAFT_ONLY",
            },
        )
        session.add(audit)
        await session.commit()

        draft_response = ComplaintDraftResponse(**draft_dict)
        download_filename = f"ShieldHer_Draft_{case.case_number}.md"

        return EscalateResponse(
            case_id=str(case.id),
            case_number=case.case_number,
            draft=draft_response,
            downloadable_markdown=draft_response.formal_complaint_body_markdown,
            downloadable_filename=download_filename,
            portal_submission_instructions=draft_response.reporting_guidance,
            recorded_user_confirmation=confirmation_record,
            notice=(
                "Draft successfully finalized for download. ShieldHer has NOT submitted this complaint "
                "to any external agency or third party. You can review, sign, and submit directly through "
                "the National Cyber Crime Reporting Portal at https://cybercrime.gov.in."
            ),
        )


# ── 4. Case-Scoped Direct Aliases ──────────────────────────────────────

@router.post(
    "/cases/{case_id}/elicit",
    response_model=ElicitationRoundResponse,
    summary="Submit answers for case elicitation round",
)
async def case_scoped_elicit(
    case_id: uuid.UUID,
    submission: ElicitationSubmission,
    current_user: User = Depends(get_current_user),
    elicit_svc: ElicitationService = Depends(get_elicitation_service),
) -> ElicitationRoundResponse:
    payload = ElicitPostPayload(
        case_id=case_id,
        round_number=submission.round_number,
        answers=submission.answers,
        skipped_question_ids=submission.skipped_question_ids,
    )
    return await submit_elicitation_round(payload, current_user, elicit_svc)


@router.post(
    "/cases/{case_id}/escalate",
    response_model=EscalateResponse,
    summary="Case-scoped escalation and draft finalization",
)
async def case_scoped_escalate(
    case_id: uuid.UUID,
    confirmation: EscalateConfirmationRequest,
    current_user: User = Depends(get_current_user),
) -> EscalateResponse:
    payload = EscalatePostPayload(
        case_id=case_id,
        acknowledged_draft_reviewed=confirmation.acknowledged_draft_reviewed,
        confirmation_notes=confirmation.confirmation_notes,
    )
    return await escalate_and_generate_draft(payload, current_user)


@router.get(
    "/cases/{case_id}/draft",
    response_model=Optional[ComplaintDraftResponse],
    summary="Retrieve current drafted complaint for case if available",
)
async def get_case_draft(
    case_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
) -> Optional[ComplaintDraftResponse]:
    async with get_db_session() as session:
        res = await session.execute(select(Case).where(Case.id == case_id))
        case = res.scalar_one_or_none()
        if not case:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")

        check_case_ownership_or_permission(case, current_user, allow_examiners=True)
        if not case.complaint_draft:
            return None
        return ComplaintDraftResponse(**case.complaint_draft)
