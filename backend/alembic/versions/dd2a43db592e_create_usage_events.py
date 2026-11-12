"""create usage events

Revision ID: dd2a43db592e
Revises: 1964bb3cf788
Create Date: 2026-11-11 22:04:29.702580

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "dd2a43db592e"
down_revision: str | Sequence[str] | None = "1964bb3cf788"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "usage_events",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column("user_id", sa.BigInteger(), nullable=True),
        sa.Column("event_type", sa.String(length=20), nullable=False),
        sa.Column("topic_id", sa.BigInteger(), nullable=True),
        sa.Column("document_id", sa.BigInteger(), nullable=True),
        sa.Column("query", sa.Text(), nullable=True),
        sa.Column("result_count", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "event_type IN ('login', 'topic_view', 'document_view', 'search')",
            name=op.f("ck_usage_events_event_type_valid"),
        ),
        sa.ForeignKeyConstraint(
            ["document_id"],
            ["documents.id"],
            name=op.f("fk_usage_events_document_id_documents"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["topic_id"],
            ["topics.id"],
            name=op.f("fk_usage_events_topic_id_topics"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_usage_events_user_id_users"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_usage_events")),
    )
    op.create_index(
        op.f("ix_usage_events_created_at"), "usage_events", ["created_at"], unique=False
    )
    op.create_index(
        "ix_usage_events_event_type_created_at",
        "usage_events",
        ["event_type", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("ix_usage_events_event_type_created_at", table_name="usage_events")
    op.drop_index(op.f("ix_usage_events_created_at"), table_name="usage_events")
    op.drop_table("usage_events")
