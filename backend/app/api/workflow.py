"""
ShieldHer – POST /workflow/execute and /workflow/review endpoints.

Exposes the LangGraph orchestration pipeline for case intake,
parallel ML verification, forensic analysis, and human examiner review.
"""
from __future__ import annotations

import datetime
import uuid
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, File, Form, Response, UploadFile, status
from pydantic import BaseModel, Field
import structlog

from app.workflows.state import HumanReviewDecision, ImageState
from app.workflows.workflow import shieldher_workflow

router = APIRouter(prefix="/workflow", tags=["workflow"])
logger = structlog.get_logger(__name__)


class HumanReviewRequest(BaseModel):
    case_id: str
    decision: HumanReviewDecision
    examiner_notes: str = Field(description="Forensic examiner observation and justification")
    reviewed_by: str = Field(description="Examiner identifier or badge/credential reference")
    human_override: bool = Field(
        default=False,
        description="Whether this human finding supersedes automated heuristics for legal proceedings",
    )


class HumanReviewResponse(BaseModel):
    case_id: str
    review_status: Dict[str, Any]
    message: str = "Human review recorded successfully without modifying original model outputs."


class WorkflowExecutionResponse(BaseModel):
    case_id: str
    session_id: str
    workflow_status: str
    human_readable_explanation: str
    evidence_manifest: Optional[Dict[str, Any]] = None
    complaint_draft: Optional[Dict[str, Any]] = None
    review_status: Optional[Dict[str, Any]] = None
    face_manipulation_result: Optional[Dict[str, Any]] = None
    ai_generation_result: Optional[Dict[str, Any]] = None
    forensic_results: Optional[Dict[str, Any]] = None
    quality_assessment: Optional[Dict[str, Any]] = None
    face_detection: Optional[Dict[str, Any]] = None
    audit_events: List[Dict[str, Any]] = Field(default_factory=list)
    errors: List[Dict[str, Any]] = Field(default_factory=list)


@router.post(
    "/execute",
    response_model=WorkflowExecutionResponse,
    summary="Execute end-to-end LangGraph forensic workflow",
    description=(
        "Runs the complete LangGraph pipeline: Image Upload → Quality Gateway → "
        "Parallel EFFORT & Smaug inference → Optional Forensic Analysis → Evidence Summary."
    ),
)
async def execute_workflow(
    response: Response,
    file: UploadFile = File(..., description="Evidence image file"),
    case_id: Optional[str] = Form(default=None, description="Optional external Case ID"),
    session_id: Optional[str] = Form(default=None, description="Optional Session ID"),
    include_forensics: bool = Form(default=True, description="Run deterministic forensic analysis"),
) -> WorkflowExecutionResponse:
    effective_case_id = case_id or f"case_{uuid.uuid4().hex[:12]}"
    effective_session_id = session_id or f"sess_{uuid.uuid4().hex[:12]}"

    try:
        raw_bytes = await file.read()
    except Exception as exc:
        logger.error("Failed to read workflow upload", error=str(exc))
        response.status_code = status.HTTP_400_BAD_REQUEST
        raise

    initial_state: ImageState = {
        "case_id": effective_case_id,
        "session_id": effective_session_id,
        "raw_bytes": raw_bytes,
        "filename": file.filename,
        "content_type": file.content_type,
        "consent_flags": {
            "consent_evidence_storage": True,
            "consent_forensic_processing": True,
            "consent_complaint_generation": True,
        },
        "include_forensics": include_forensics,
        "errors": [],
        "audit_events": [],
    }

    # Execute compiled LangGraph workflow
    final_state = await shieldher_workflow.ainvoke(initial_state)

    return WorkflowExecutionResponse(
        case_id=effective_case_id,
        session_id=effective_session_id,
        workflow_status=final_state.get("workflow_status", "UNKNOWN"),
        human_readable_explanation=final_state.get("human_readable_explanation", ""),
        evidence_manifest=final_state.get("evidence_manifest"),
        complaint_draft=final_state.get("complaint_draft"),
        review_status=final_state.get("review_status"),
        face_manipulation_result=final_state.get("face_manipulation_result"),
        ai_generation_result=final_state.get("ai_generation_result"),
        forensic_results=final_state.get("forensic_results"),
        quality_assessment=final_state.get("quality_assessment"),
        face_detection=final_state.get("face_detection"),
        audit_events=final_state.get("audit_events", []),
        errors=final_state.get("errors", []),
    )


@router.post(
    "/review",
    response_model=HumanReviewResponse,
    summary="Record human examiner review and annotation",
    description=(
        "Appends human forensic review decisions and examiner notes to a case. "
        "Original model outputs are strictly preserved and never overwritten."
    ),
)
async def submit_human_review(review: HumanReviewRequest) -> HumanReviewResponse:
    recorded_review = {
        "decision": review.decision.value,
        "examiner_notes": review.examiner_notes,
        "reviewed_by": review.reviewed_by,
        "reviewed_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "human_override": review.human_override,
    }

    logger.info(
        "Recorded human examiner review",
        case_id=review.case_id,
        decision=review.decision.value,
        reviewed_by=review.reviewed_by,
    )

    return HumanReviewResponse(
        case_id=review.case_id,
        review_status=recorded_review,
    )
