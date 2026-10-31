"""
ShieldHer – LangGraph Workflow Graph Assembly.

Flow:
Image Upload → Quality Gateway → Parallel EFFORT and Smaug inference → Optional Forensic Analysis → Evidence Summary.

Orchestrates the independent models with fault isolation, native score preservation,
evidentiary state synthesis, and human examiner review hooks.
"""
from __future__ import annotations

from typing import List, Union
from langgraph.graph import END, START, StateGraph

from app.schemas.upload import AssessmentStatus
from app.workflows.nodes import (
    effort_detection_node,
    evidence_summary_node,
    forensic_analysis_node,
    quality_gateway_node,
    smaug_detection_node,
    upload_node,
)
from app.workflows.state import ImageState


def route_after_quality_gateway(state: ImageState) -> Union[List[str], str]:
    """
    Branching condition after Quality Gateway:
    - If Quality Gateway PASS: fan-out to parallel Effort and Smaug inference.
    - If Quality Gateway UNSUPPORTED_INPUT or RETRY_REQUIRED: skip ML and route to summary.
    """
    qa = state.get("quality_assessment") or {}
    q_status = qa.get("status")

    if q_status == AssessmentStatus.PASS.value:
        return ["effort_detection", "smaug_detection"]
    return "evidence_summary"


def create_shieldher_workflow():
    """
    Constructs and compiles the ShieldHer LangGraph forensic workflow.
    """
    builder = StateGraph(ImageState)

    # 1. Register workflow nodes
    builder.add_node("upload", upload_node)
    builder.add_node("quality_gateway", quality_gateway_node)
    builder.add_node("effort_detection", effort_detection_node)
    builder.add_node("smaug_detection", smaug_detection_node)
    builder.add_node("forensic_analysis", forensic_analysis_node)
    builder.add_node("evidence_summary", evidence_summary_node)

    # 2. Sequential pipeline: Upload -> Quality Gateway
    builder.add_edge(START, "upload")
    builder.add_edge("upload", "quality_gateway")

    # 3. Conditional Fan-Out after Quality Gateway
    builder.add_conditional_edges(
        "quality_gateway",
        route_after_quality_gateway,
        ["effort_detection", "smaug_detection", "evidence_summary"],
    )

    # 4. Parallel Fan-In: Effort and Smaug both lead to Forensic Analysis
    builder.add_edge("effort_detection", "forensic_analysis")
    builder.add_edge("smaug_detection", "forensic_analysis")

    # 5. Forensic Analysis leads to Evidence Summary
    builder.add_edge("forensic_analysis", "evidence_summary")

    # 6. Evidence Summary completes workflow
    builder.add_edge("evidence_summary", END)

    return builder.compile()


# Singleton compiled workflow instance
shieldher_workflow = create_shieldher_workflow()
