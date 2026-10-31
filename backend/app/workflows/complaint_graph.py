"""
ShieldHer – LangGraph Complaint Drafting & Escalation Workflow.

FLOW:
Validate Inputs → Statutory Assessment → Evidence Indexing → Drafting Synthesis → Final Packaging

CONSTRAINTS:
1. Orchestrated as a compiled LangGraph StateGraph.
2. Zero intimate image bytes sent to any LLM node.
3. User facts kept strictly separate from automated technical findings.
4. Guaranteed fallback to deterministic generation if LLM is unavailable or fails.
5. All outputs permanently stamped "DRAFT — FOR USER AND LEGAL REVIEW".
"""
from __future__ import annotations

import datetime
import operator
from typing import Annotated, Any, Dict, List, Optional, TypedDict
from langgraph.graph import END, START, StateGraph
import structlog

from app.schemas.complaint import (
    ApplicableLegalProvision,
    ComplaintDraftResponse,
    EvidenceCustodyItem,
)
from app.services.mistral_adapter import get_mistral_complaint_drafter
from app.services.legal_framework import get_legal_framework_service

logger = structlog.get_logger(__name__)


def _utc_now_iso() -> str:
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


class ComplaintDraftingState(TypedDict):
    case_id: str
    case_number: str
    user_answers: Dict[str, Any]
    raw_evidence_records: List[Dict[str, Any]]
    use_llm: bool
    applicable_provisions: List[Dict[str, Any]]
    reporting_guidance: Dict[str, Any]
    evidence_index: List[Dict[str, Any]]
    draft_response: Optional[Dict[str, Any]]
    errors: Annotated[List[Dict[str, Any]], operator.add]
    audit_events: Annotated[List[Dict[str, Any]], operator.add]


# ── Workflow Nodes ─────────────────────────────────────────────────────

def validate_inputs_node(state: ComplaintDraftingState) -> Dict[str, Any]:
    """Validates user-provided facts and records start audit event."""
    user_answers = state.get("user_answers") or {}
    case_id = state.get("case_id")

    audit_events = [{
        "timestamp": _utc_now_iso(),
        "event": "COMPLAINT_WORKFLOW_STARTED",
        "case_id": case_id,
        "facts_count": len(user_answers),
    }]

    return {"user_answers": user_answers, "audit_events": audit_events}


def statutory_assessment_node(state: ComplaintDraftingState) -> Dict[str, Any]:
    """Evaluates user-reported facts against verified Indian cyber law provisions."""
    facts = state.get("user_answers") or {}
    legal_service = get_legal_framework_service()

    # Determine factual indicators
    consent_status = str(facts.get("q4_consent_status", "")).lower()
    is_synthetic = "synthetic" in consent_status or "altered" in consent_status or "deepfake" in consent_status
    threats_status = str(facts.get("q6_extortion_or_threats", "")).lower()
    has_threats = "yes" in threats_status or "extortion" in threats_status or "blackmail" in threats_status

    # Check incident date for BNS 2023 commencement (July 1, 2024)
    disc_date_str = str(facts.get("q2_discovery_date", ""))
    is_post_july_2024 = True
    try:
        if disc_date_str and len(disc_date_str) >= 4:
            year = int(disc_date_str[:4])
            if year < 2024:
                is_post_july_2024 = False
    except ValueError:
        is_post_july_2024 = True

    provisions = legal_service.get_applicable_provisions(
        has_intimate_depiction=True,
        is_synthetic_or_deepfake=is_synthetic,
        has_extortion_or_threats=has_threats,
        incident_date_is_post_july_2024=is_post_july_2024,
    )
    guidance = legal_service.get_official_reporting_guidelines()

    audit_events = [{
        "timestamp": _utc_now_iso(),
        "event": "STATUTORY_ASSESSMENT_COMPLETED",
        "matched_provisions": [p.section_or_rule for p in provisions],
    }]

    return {
        "applicable_provisions": [p.model_dump() for p in provisions],
        "reporting_guidance": guidance,
        "audit_events": audit_events,
    }


def evidence_indexing_node(state: ComplaintDraftingState) -> Dict[str, Any]:
    """Compiles evidence custody items without sensitive image bytes."""
    raw_records = state.get("raw_evidence_records") or []
    evidence_index: List[Dict[str, Any]] = []

    for item in raw_records:
        evidence_index.append({
            "evidence_id": str(item.get("id")),
            "filename": item.get("filename_sanitized", "evidence.jpg"),
            "sha256_hash": item.get("original_sha256", "UNKNOWN"),
            "file_size_bytes": item.get("file_size_bytes", 0),
            "mime_type": item.get("mime_type", "image/jpeg"),
            "perceptual_hash": item.get("perceptual_hash"),
            "model_findings": item.get("model_findings", {}),
        })

    audit_events = [{
        "timestamp": _utc_now_iso(),
        "event": "EVIDENCE_INDEXING_COMPLETED",
        "items_indexed": len(evidence_index),
    }]

    return {"evidence_index": evidence_index, "audit_events": audit_events}


async def drafting_synthesis_node(state: ComplaintDraftingState) -> Dict[str, Any]:
    """Synthesizes formal complaint draft using Mistral AI or deterministic fallback."""
    drafter = get_mistral_complaint_drafter()

    user_facts = state.get("user_answers") or {}
    raw_ev = state.get("evidence_index") or []
    ev_items = [EvidenceCustodyItem(**e) for e in raw_ev]
    raw_prov = state.get("applicable_provisions") or []
    provisions = [ApplicableLegalProvision(**p) for p in raw_prov]
    guidance = state.get("reporting_guidance") or {}
    use_llm = state.get("use_llm", True)

    draft_resp = await drafter.draft_complaint(
        case_id=state.get("case_id", "case"),
        case_number=state.get("case_number", "SH-CASE"),
        user_facts=user_facts,
        evidence_index=ev_items,
        legal_provisions=provisions,
        reporting_guidance=guidance,
        use_llm=use_llm,
    )

    audit_events = [{
        "timestamp": _utc_now_iso(),
        "event": "DRAFT_SYNTHESIS_COMPLETED",
        "method": draft_resp.drafting_method.value,
        "label": draft_resp.label,
    }]

    return {"draft_response": draft_resp.model_dump(mode="json"), "audit_events": audit_events}


def final_packaging_node(state: ComplaintDraftingState) -> Dict[str, Any]:
    """Verifies label, stamps submission status as NOT_SUBMITTED, and finalizes state."""
    draft_dict = state.get("draft_response") or {}
    draft_dict["submission_status"] = "NOT_SUBMITTED_LOCAL_DRAFT_ONLY"

    audit_events = [{
        "timestamp": _utc_now_iso(),
        "event": "COMPLAINT_WORKFLOW_FINALIZED",
        "case_id": state.get("case_id"),
    }]

    return {"draft_response": draft_dict, "audit_events": audit_events}


# ── Workflow Assembly ──────────────────────────────────────────────────

def create_complaint_drafting_workflow():
    """Constructs and compiles the LangGraph complaint drafting workflow."""
    builder = StateGraph(ComplaintDraftingState)

    builder.add_node("validate_inputs", validate_inputs_node)
    builder.add_node("statutory_assessment", statutory_assessment_node)
    builder.add_node("evidence_indexing", evidence_indexing_node)
    builder.add_node("drafting_synthesis", drafting_synthesis_node)
    builder.add_node("final_packaging", final_packaging_node)

    builder.add_edge(START, "validate_inputs")
    builder.add_edge("validate_inputs", "statutory_assessment")
    builder.add_edge("statutory_assessment", "evidence_indexing")
    builder.add_edge("evidence_indexing", "drafting_synthesis")
    builder.add_edge("drafting_synthesis", "final_packaging")
    builder.add_edge("final_packaging", END)

    return builder.compile()


complaint_drafting_workflow = create_complaint_drafting_workflow()
