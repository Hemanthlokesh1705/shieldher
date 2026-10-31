"""add_elicitation_and_drafting_to_cases

Revision ID: 0003_add_elicitation_and_drafting_to_cases
Revises: 0002_add_reverse_search_results
Create Date: 2026-10-30 15:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0003_add_elicitation_drafting"
down_revision: Union[str, None] = "0002_add_reverse_search_results"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("cases", sa.Column("elicited_answers", sa.JSON(), nullable=True))
    op.add_column("cases", sa.Column("complaint_draft", sa.JSON(), nullable=True))
    op.add_column(
        "cases",
        sa.Column("escalation_status", sa.String(length=64), server_default="DRAFT_LOCAL_ONLY", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("cases", "escalation_status")
    op.drop_column("cases", "complaint_draft")
    op.drop_column("cases", "elicited_answers")
