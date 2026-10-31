"""
ShieldHer – Predefined Information Elicitation Question Bank & Service.

DESIGN RULES:
1. Maximum of 3 questionnaire rounds to avoid trauma fatigue.
2. Inquires ONLY for facts necessary to prepare a formal legal report.
3. Every question is skippable; victims can advance at their own pace.
4. User facts are recorded neutrally without leading questions or assumptions.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional
import structlog

from app.schemas.complaint import (
    ElicitationQuestion,
    ElicitationRoundResponse,
    ElicitationSubmission,
    QuestionType,
)

logger = structlog.get_logger(__name__)


# ── Predefined Question Bank (Maximum 3 Rounds) ────────────────────────

QUESTION_BANK: Dict[int, List[ElicitationQuestion]] = {
    1: [
        ElicitationQuestion(
            id="q1_platform",
            round_number=1,
            question_text="On which online platform, app, or website was the imagery observed or distributed?",
            question_type=QuestionType.TEXT,
            options=None,
            helper_text="Examples: Telegram channel, Instagram DM, WhatsApp group, Reddit, custom website URL.",
            is_skippable=True,
        ),
        ElicitationQuestion(
            id="q2_discovery_date",
            round_number=1,
            question_text="When did you first discover or become aware of this distribution? (Approximate date is acceptable)",
            question_type=QuestionType.DATE,
            options=None,
            helper_text="Timestamps help determine legal applicability (e.g. IT Rules 2021 24h deadline, BNS 2023 commencement).",
            is_skippable=True,
        ),
        ElicitationQuestion(
            id="q3_urls_or_handles",
            round_number=1,
            question_text="Are there specific URLs, links, or account handles associated with the distribution?",
            question_type=QuestionType.TEXT,
            options=None,
            helper_text="Providing exact URLs helps platforms locate and remove the content quickly.",
            is_skippable=True,
        ),
    ],
    2: [
        ElicitationQuestion(
            id="q4_consent_status",
            round_number=2,
            question_text="What is the consent status regarding the creation and distribution of this imagery?",
            question_type=QuestionType.SINGLE_CHOICE,
            options=[
                "Never consented to capture, possession, or distribution",
                "Consented to private creation, but NEVER to sharing or publication",
                "Image is synthetic, altered, morphed, or deepfaked without consent",
                "Prefer not to answer at this time",
            ],
            helper_text="Non-consensual dissemination is illegal under Section 66E IT Act and Section 77 BNS regardless of original creation context.",
            is_skippable=True,
        ),
        ElicitationQuestion(
            id="q5_suspect_information",
            round_number=2,
            question_text="Is the identity of the person responsible known or suspected?",
            question_type=QuestionType.SINGLE_CHOICE,
            options=[
                "Known individual (e.g., former partner, acquaintance, coworker)",
                "Anonymous online user / Unknown party",
                "Account compromised / Hacking suspected",
                "Prefer not to disclose at this time",
            ],
            helper_text="If unknown, state unknown. ShieldHer will NEVER invent or assume suspect identity.",
            is_skippable=True,
        ),
        ElicitationQuestion(
            id="q6_extortion_or_threats",
            round_number=2,
            question_text="Have you received any monetary demands, blackmail, or threats related to this imagery?",
            question_type=QuestionType.SINGLE_CHOICE,
            options=[
                "Yes — received explicit monetary extortion or threats",
                "Yes — received harassment or coercive threats (non-monetary)",
                "No — no direct communication received",
                "Prefer not to answer",
            ],
            helper_text="Threats of circulation trigger extortion provisions under Section 308 & 351 BNS / Section 503 & 506 IPC.",
            is_skippable=True,
        ),
    ],
    3: [
        ElicitationQuestion(
            id="q7_takedown_status",
            round_number=3,
            question_text="Have you already submitted a takedown notice to the hosting platform's grievance officer?",
            question_type=QuestionType.SINGLE_CHOICE,
            options=[
                "Yes — submitted, awaiting 24-hour compliance",
                "Yes — submitted, but platform refused or failed to act",
                "No — have not contacted platform yet",
                "Unknown / Not sure",
            ],
            helper_text="Helps determine whether platform safe-harbor protections apply under Section 79 IT Act.",
            is_skippable=True,
        ),
        ElicitationQuestion(
            id="q8_immediate_safety",
            round_number=3,
            question_text="Are you currently experiencing immediate offline harassment, stalking, or physical safety concerns?",
            question_type=QuestionType.SINGLE_CHOICE,
            options=[
                "Yes — immediate safety or offline harassment concern",
                "No — online distribution only",
                "Prefer not to say",
            ],
            helper_text="Immediate threats warrant urgent contact with National Helpline 1930 / 112.",
            is_skippable=True,
        ),
        ElicitationQuestion(
            id="q9_desired_escalation",
            round_number=3,
            question_text="Which legal documents do you wish to prepare?",
            question_type=QuestionType.MULTI_CHOICE,
            options=[
                "National Cyber Crime Reporting Portal Complaint Draft (cybercrime.gov.in)",
                "Intermediary Rule 3(2)(b) 24-Hour Mandatory Takedown Notice",
                "Forensic Chain of Custody & Evidence Brief for Legal Counsel",
            ],
            helper_text="Select all that apply. All drafts will be generated locally for your review.",
            is_skippable=True,
        ),
    ],
}


class ElicitationService:
    """Orchestrates multi-round information elicitation with safe skippable forms."""

    @staticmethod
    def get_round_questions(round_number: int, case_id: str, existing_answers: Optional[Dict[str, Any]] = None) -> ElicitationRoundResponse:
        """Retrieves questions for the requested round (1, 2, or 3)."""
        valid_round = max(1, min(3, round_number))
        questions = QUESTION_BANK.get(valid_round, [])

        guidance_map = {
            1: "Round 1 of 3: Incident Discovery. Share what you know about where and when the imagery appeared. You may skip any question.",
            2: "Round 2 of 3: Consent & Impact. Document whether consent was given and any threats received. You may skip any question.",
            3: "Round 3 of 3: Escalation & Remedies. Select the formal documents you wish to prepare. All drafts remain private to your case.",
        }

        return ElicitationRoundResponse(
            case_id=case_id,
            current_round=valid_round,
            total_rounds=3,
            is_final_round=(valid_round == 3),
            questions=questions,
            previously_recorded_answers=existing_answers or {},
            guidance_message=guidance_map[valid_round],
        )

    @staticmethod
    def merge_answers(
        existing_answers: Optional[Dict[str, Any]],
        submission: ElicitationSubmission,
    ) -> Dict[str, Any]:
        """Merges new answers, recording skipped questions explicitly."""
        merged = dict(existing_answers or {})
        for q_id, val in submission.answers.items():
            if val is not None and str(val).strip():
                merged[q_id] = val

        for skipped_id in submission.skipped_question_ids:
            merged[skipped_id] = "[SKIPPED_BY_USER]"

        return merged


_elicitation_service: ElicitationService | None = None


def get_elicitation_service() -> ElicitationService:
    global _elicitation_service
    if _elicitation_service is None:
        _elicitation_service = ElicitationService()
    return _elicitation_service
