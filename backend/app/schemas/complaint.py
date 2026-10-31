"""
ShieldHer – Schemas for Victim Elicitation, Complaint Drafting, and Escalation.

DESIGN PRINCIPLES:
1. User-reported facts are strictly segregated from automated technical findings.
2. Drafts are permanently stamped "DRAFT — FOR USER AND LEGAL REVIEW".
3. Zero hallucination: suspects, dates, and unverified events are never invented.
4. Never auto-submits to third-party portals or authorities.
"""
from __future__ import annotations

import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class QuestionType(str, Enum):
    TEXT = "text"
    SINGLE_CHOICE = "single_choice"
    MULTI_CHOICE = "multi_choice"
    DATE = "date"


class DraftingMethod(str, Enum):
    CONSTRAINED_MISTRAL_SYNTHESIS = "CONSTRAINED_MISTRAL_SYNTHESIS"
    CONSTRAINED_CLAUDE_SYNTHESIS = "CONSTRAINED_CLAUDE_SYNTHESIS"  # Backwards-compatible alias
    DETERMINISTIC_SAFE_FALLBACK = "DETERMINISTIC_SAFE_FALLBACK"


# ── 1. Elicitation Question & Answer Schemas ───────────────────────────

class ElicitationQuestion(BaseModel):
    id: str = Field(..., description="Unique question identifier (e.g., q1_platform)")
    round_number: int = Field(..., ge=1, le=3, description="Questionnaire round (1, 2, or 3)")
    question_text: str = Field(..., description="Victim-centered, respectful inquiry prompt")
    question_type: QuestionType = Field(..., description="Expected UI input component")
    options: Optional[List[str]] = Field(None, description="Selectable response choices for choice types")
    helper_text: str = Field(..., description="Contextual guidance explaining why this information helps")
    is_skippable: bool = Field(True, description="All questions are skippable to avoid victim distress")


class ElicitationRoundResponse(BaseModel):
    case_id: str
    current_round: int
    total_rounds: int = 3
    is_final_round: bool
    questions: List[ElicitationQuestion]
    previously_recorded_answers: Dict[str, Any] = Field(default_factory=dict)
    guidance_message: str


class ElicitationSubmission(BaseModel):
    round_number: int = Field(..., ge=1, le=3)
    answers: Dict[str, Any] = Field(
        default_factory=dict,
        description="Key-value mapping of question IDs to victim responses",
    )
    skipped_question_ids: List[str] = Field(
        default_factory=list,
        description="Question IDs explicitly skipped by the victim",
    )


# ── 2. Legal Citations & Applicability ─────────────────────────────────

class ApplicableLegalProvision(BaseModel):
    statute: str = Field(..., description="e.g. Information Technology Act, 2000; Bhartiya Nyaya Sanhita, 2023")
    section_or_rule: str = Field(..., description="e.g. Section 66E, Section 67A, Rule 3(2)(b)")
    title: str = Field(..., description="Official title of the legal provision")
    commencement_date: str = Field(..., description="Statutory commencement date")
    relevance_and_conditions: str = Field(
        ...,
        description="Factual prerequisites and non-presumptive explanation of potential applicability",
    )
    statutory_deadline: Optional[str] = Field(
        None,
        description="Mandated statutory response deadline if applicable (e.g. 24h under Rule 3(2)(b))",
    )
    official_source_url: str = Field(..., description="Official gazette or repository reference URL")


class EvidenceCustodyItem(BaseModel):
    evidence_id: str
    filename: str
    sha256_hash: str
    file_size_bytes: int
    mime_type: str
    perceptual_hash: Optional[str] = None
    model_findings: Dict[str, Any] = Field(
        default_factory=dict,
        description="Effort face manipulation scores, Smaug AI generation score, quality metrics",
    )


# ── 3. Complaint Draft & Escalation Schemas ────────────────────────────

class ComplaintDraftRequest(BaseModel):
    include_technical_forensics: bool = Field(
        True,
        description="Include cryptographic hashes and forensic model metrics in the report draft",
    )
    include_intermediary_takedown_notice: bool = Field(
        True,
        description="Generate an IT Rules 2021 Rule 3(2)(b) emergency 24-hour takedown notice",
    )
    include_cybercrime_portal_format: bool = Field(
        True,
        description="Format complaint narrative to match cybercrime.gov.in reporting categories",
    )
    use_llm_if_available: bool = Field(
        True,
        description="Use Mistral AI API for synthesis if configured, else use deterministic template fallback",
    )


class ComplaintDraftResponse(BaseModel):
    case_id: str
    case_number: str
    label: str = "DRAFT — FOR USER AND LEGAL REVIEW"
    generated_at: datetime.datetime
    drafting_method: DraftingMethod
    incident_summary: str = Field(
        ...,
        description="Synthesized summary based strictly on user-reported facts. Suspects/events are NEVER invented.",
    )
    user_reported_facts: Dict[str, Any] = Field(
        default_factory=dict,
        description="Factual statements reported directly by the victim",
    )
    technical_findings_summary: Dict[str, Any] = Field(
        default_factory=dict,
        description="Independent automated technical measurements kept strictly separate from user facts",
    )
    evidence_index: List[EvidenceCustodyItem] = Field(default_factory=list)
    applicable_legal_framework: List[ApplicableLegalProvision] = Field(default_factory=list)
    formal_complaint_body_markdown: str = Field(
        ...,
        description="Full markdown text of the draft ready for review and printing",
    )
    intermediary_takedown_notice_markdown: Optional[str] = Field(
        None,
        description="Standalone 24-hour emergency intermediary takedown notice under Rule 3(2)(b)",
    )
    reporting_guidance: Dict[str, Any] = Field(
        ...,
        description="Official step-by-step guidance for filing on cybercrime.gov.in and contacting 1930",
    )
    submission_status: str = "NOT_SUBMITTED_LOCAL_DRAFT_ONLY"
    disclaimer: str = (
        "CRITICAL NOTICE: This document is an investigative draft generated to assist the user "
        "and legal counsel. It DOES NOT constitute legal advice or an automated filing. ShieldHer "
        "NEVER automatically submits complaints to law enforcement, tech platforms, or third parties. "
        "The victim or authorized legal representative must review, sign, and submit directly through "
        "official designated reporting channels."
    )


class EscalateConfirmationRequest(BaseModel):
    acknowledged_draft_reviewed: bool = Field(
        ...,
        description="Affirmative confirmation that user has reviewed the draft complaint for factual accuracy",
    )
    consent_recorded_at: datetime.datetime = Field(
        default_factory=lambda: datetime.datetime.now(datetime.timezone.utc),
    )
    confirmation_notes: Optional[str] = None


class EscalateResponse(BaseModel):
    case_id: str
    case_number: str
    draft: ComplaintDraftResponse
    downloadable_markdown: str
    downloadable_filename: str
    portal_submission_instructions: Dict[str, Any]
    recorded_user_confirmation: Dict[str, Any]
    notice: str = (
        "Draft successfully generated and finalized for download. ShieldHer has NOT submitted this "
        "complaint to any external party. Follow the included instructions to file at https://cybercrime.gov.in."
    )
