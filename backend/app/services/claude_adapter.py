"""
ShieldHer – Mistral AI Adapter compatibility bridge (re-exports ClaudeComplaintDrafter).
"""
from app.services.mistral_adapter import (
    MistralComplaintDrafter,
    MistralComplaintDrafter as ClaudeComplaintDrafter,
    get_mistral_complaint_drafter,
    get_mistral_complaint_drafter as get_claude_complaint_drafter,
)

__all__ = [
    "MistralComplaintDrafter",
    "ClaudeComplaintDrafter",
    "get_mistral_complaint_drafter",
    "get_claude_complaint_drafter",
]
