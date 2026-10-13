"""create content tables

Revision ID: 6de3ee5b4d8c
Revises: 6ddc0a734e48
Create Date: 2026-10-12 21:43:43.378070

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "6de3ee5b4d8c"
down_revision: str | Sequence[str] | None = "6ddc0a734e48"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "offices",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("email", sa.String(length=320), nullable=True),
        sa.Column("phone", sa.String(length=50), nullable=True),
        sa.Column("url", sa.String(length=2000), nullable=True),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_offices")),
        sa.UniqueConstraint("name", name=op.f("uq_offices_name")),
    )
    op.create_table(
        "documents",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("doc_type", sa.String(length=20), nullable=False),
        sa.Column("citation", sa.String(length=200), nullable=True),
        sa.Column("source_url", sa.String(length=2000), nullable=True),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("content_text", sa.Text(), server_default="", nullable=False),
        sa.Column("content_hash", sa.String(length=64), nullable=True),
        sa.Column("office_id", sa.BigInteger(), nullable=True),
        sa.Column("status", sa.String(length=20), server_default="draft", nullable=False),
        sa.Column(
            "is_authoritative", sa.Boolean(), server_default=sa.text("false"), nullable=False
        ),
        sa.Column("replaced_by_id", sa.BigInteger(), nullable=True),
        sa.Column("effective_date", sa.Date(), nullable=True),
        sa.Column("last_reviewed_at", sa.Date(), nullable=True),
        sa.Column("review_due_at", sa.Date(), nullable=True),
        sa.Column("created_by", sa.BigInteger(), nullable=True),
        sa.Column("updated_by", sa.BigInteger(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "search_vector",
            postgresql.TSVECTOR(),
            sa.Computed(
                "setweight(to_tsvector('english', coalesce(title, '')), 'A') || "
                "setweight(to_tsvector('english', coalesce(summary, '')), 'B') || "
                "setweight(to_tsvector('english', coalesce(content_text, '')), 'C')",
                persisted=True,
            ),
            nullable=False,
        ),
        sa.CheckConstraint(
            "doc_type IN ('policy', 'sop', 'guidance', 'faq', 'webpage', 'job_aid', 'other')",
            name=op.f("ck_documents_doc_type_valid"),
        ),
        sa.CheckConstraint(
            "status IN ('draft', 'active', 'archived')", name=op.f("ck_documents_status_valid")
        ),
        sa.ForeignKeyConstraint(
            ["created_by"], ["users.id"], name=op.f("fk_documents_created_by_users")
        ),
        sa.ForeignKeyConstraint(
            ["office_id"], ["offices.id"], name=op.f("fk_documents_office_id_offices")
        ),
        sa.ForeignKeyConstraint(
            ["replaced_by_id"], ["documents.id"], name=op.f("fk_documents_replaced_by_id_documents")
        ),
        sa.ForeignKeyConstraint(
            ["updated_by"], ["users.id"], name=op.f("fk_documents_updated_by_users")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_documents")),
    )
    op.create_index(
        "ix_documents_search_vector",
        "documents",
        ["search_vector"],
        unique=False,
        postgresql_using="gin",
    )
    op.create_table(
        "topics",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column("slug", sa.String(length=100), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), server_default="", nullable=False),
        sa.Column("parent_id", sa.BigInteger(), nullable=True),
        sa.Column("default_office_id", sa.BigInteger(), nullable=True),
        sa.Column("sort_order", sa.Integer(), server_default="0", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.ForeignKeyConstraint(
            ["default_office_id"], ["offices.id"], name=op.f("fk_topics_default_office_id_offices")
        ),
        sa.ForeignKeyConstraint(
            ["parent_id"], ["topics.id"], name=op.f("fk_topics_parent_id_topics")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_topics")),
        sa.UniqueConstraint("slug", name=op.f("uq_topics_slug")),
    )
    op.create_table(
        "document_topics",
        sa.Column("document_id", sa.BigInteger(), nullable=False),
        sa.Column("topic_id", sa.BigInteger(), nullable=False),
        sa.ForeignKeyConstraint(
            ["document_id"],
            ["documents.id"],
            name=op.f("fk_document_topics_document_id_documents"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["topic_id"],
            ["topics.id"],
            name=op.f("fk_document_topics_topic_id_topics"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("document_id", "topic_id", name=op.f("pk_document_topics")),
    )
    op.create_index(
        op.f("ix_document_topics_topic_id"), "document_topics", ["topic_id"], unique=False
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_document_topics_topic_id"), table_name="document_topics")
    op.drop_table("document_topics")
    op.drop_table("topics")
    op.drop_index("ix_documents_search_vector", table_name="documents", postgresql_using="gin")
    op.drop_table("documents")
    op.drop_table("offices")
