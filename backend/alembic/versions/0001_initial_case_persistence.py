"""initial_case_persistence

Revision ID: 0001_initial_case_persistence
Revises: 
Create Date: 2026-10-30 12:50:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0001_initial_case_persistence"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. users table
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=True),
        sa.Column("role", sa.String(length=32), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    # 2. cases table
    op.create_table(
        "cases",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("case_number", sa.String(length=64), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("incident_description", sa.Text(), nullable=True),
        sa.Column("incident_date", sa.Date(), nullable=True),
        sa.Column("platform_observed", sa.String(length=128), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("retention_policy", sa.String(length=32), nullable=False),
        sa.Column("retention_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("review_status", sa.String(length=64), nullable=False, server_default="UNREVIEWED"),
        sa.Column("examiner_notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_cases_case_number", "cases", ["case_number"], unique=True)
    op.create_index("ix_cases_user_id", "cases", ["user_id"], unique=False)

    # 3. evidence_items table
    op.create_table(
        "evidence_items",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("case_id", sa.Uuid(), nullable=False),
        sa.Column("filename_sanitized", sa.String(length=255), nullable=False),
        sa.Column("original_sha256", sa.String(length=64), nullable=False),
        sa.Column("mime_type", sa.String(length=64), nullable=False),
        sa.Column("file_size_bytes", sa.Integer(), nullable=False),
        sa.Column("storage_key_encrypted_evidence", sa.String(length=255), nullable=True),
        sa.Column("storage_key_derivatives", sa.String(length=255), nullable=True),
        sa.Column("storage_key_forensic_report", sa.String(length=255), nullable=True),
        sa.Column("encryption_iv_hex", sa.String(length=64), nullable=True),
        sa.Column("is_preserved", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("model_versions", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["case_id"], ["cases.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_evidence_items_case_id", "evidence_items", ["case_id"], unique=False)
    op.create_index("ix_evidence_items_original_sha256", "evidence_items", ["original_sha256"], unique=False)

    # 4. model_outputs table
    op.create_table(
        "model_outputs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("evidence_id", sa.Uuid(), nullable=False),
        sa.Column("case_id", sa.Uuid(), nullable=False),
        sa.Column("detector_name", sa.String(length=128), nullable=False),
        sa.Column("model_version", sa.String(length=64), nullable=False),
        sa.Column("checkpoint_identifier", sa.String(length=128), nullable=False),
        sa.Column("status", sa.String(length=64), nullable=False),
        sa.Column("raw_score", sa.Float(), nullable=True),
        sa.Column("predicted_label", sa.String(length=64), nullable=True),
        sa.Column("score_semantics", sa.Text(), nullable=False),
        sa.Column("execution_duration_ms", sa.Float(), nullable=True),
        sa.Column("details_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["case_id"], ["cases.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["evidence_id"], ["evidence_items.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_model_outputs_case_id", "model_outputs", ["case_id"], unique=False)
    op.create_index("ix_model_outputs_evidence_id", "model_outputs", ["evidence_id"], unique=False)

    # 5. evidence_manifest_entries table
    op.create_table(
        "evidence_manifest_entries",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("case_id", sa.Uuid(), nullable=False),
        sa.Column("evidence_id", sa.Uuid(), nullable=False),
        sa.Column("manifest_sha256", sa.String(length=64), nullable=False),
        sa.Column("manifest_data", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["case_id"], ["cases.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["evidence_id"], ["evidence_items.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_evidence_manifest_entries_case_id", "evidence_manifest_entries", ["case_id"], unique=False)
    op.create_index("ix_evidence_manifest_entries_evidence_id", "evidence_manifest_entries", ["evidence_id"], unique=False)

    # 6. deletion_requests table
    op.create_table(
        "deletion_requests",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("case_id", sa.Uuid(), nullable=False),
        sa.Column("evidence_id", sa.Uuid(), nullable=True),
        sa.Column("requested_by_user_id", sa.Uuid(), nullable=False),
        sa.Column("requester_role", sa.String(length=64), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("evidence_sha256_snapshot", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="COMPLETED"),
        sa.Column("requested_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["case_id"], ["cases.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_deletion_requests_case_id", "deletion_requests", ["case_id"], unique=False)

    # 7. audit_logs table
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("case_id", sa.Uuid(), nullable=True),
        sa.Column("user_id", sa.Uuid(), nullable=True),
        sa.Column("action", sa.String(length=64), nullable=False),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.Column("details_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"], unique=False)
    op.create_index("ix_audit_logs_case_id", "audit_logs", ["case_id"], unique=False)
    op.create_index("ix_audit_logs_user_id", "audit_logs", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.drop_table("deletion_requests")
    op.drop_table("evidence_manifest_entries")
    op.drop_table("model_outputs")
    op.drop_table("evidence_items")
    op.drop_table("cases")
    op.drop_table("users")
