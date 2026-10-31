"""add_reverse_search_results

Revision ID: 0002_add_reverse_search_results
Revises: 0001_initial_case_persistence
Create Date: 2026-10-30 13:25:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0002_add_reverse_search_results"
down_revision: Union[str, None] = "0001_initial_case_persistence"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "reverse_search_results",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("case_id", sa.Uuid(), nullable=False),
        sa.Column("evidence_id", sa.Uuid(), nullable=False),
        sa.Column("requested_by_user_id", sa.Uuid(), nullable=False),
        sa.Column("provider", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("query_image_sha256", sa.String(length=64), nullable=False),
        sa.Column("query_phash", sa.String(length=64), nullable=True),
        sa.Column("exact_matches_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("visual_matches_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("exact_matches", sa.JSON(), nullable=False),
        sa.Column("visual_matches", sa.JSON(), nullable=False),
        sa.Column("returned_urls", sa.JSON(), nullable=False),
        sa.Column("search_duration_ms", sa.Float(), nullable=True),
        sa.Column("consent_confirmed", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("consent_timestamp", sa.DateTime(timezone=True), nullable=True),
        sa.Column("disclaimer", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["case_id"], ["cases.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["evidence_id"], ["evidence_items.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_reverse_search_results_case_id", "reverse_search_results", ["case_id"])
    op.create_index("ix_reverse_search_results_evidence_id", "reverse_search_results", ["evidence_id"])
    op.create_index("ix_reverse_search_results_requested_by_user_id", "reverse_search_results", ["requested_by_user_id"])


def downgrade() -> None:
    op.drop_index("ix_reverse_search_results_requested_by_user_id", table_name="reverse_search_results")
    op.drop_index("ix_reverse_search_results_evidence_id", table_name="reverse_search_results")
    op.drop_index("ix_reverse_search_results_case_id", table_name="reverse_search_results")
    op.drop_table("reverse_search_results")
