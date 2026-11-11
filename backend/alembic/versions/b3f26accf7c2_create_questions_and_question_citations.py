"""create questions and question citations

Revision ID: b3f26accf7c2
Revises: 2743ef7700b3
Create Date: 2026-11-10 20:55:42.531630

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b3f26accf7c2"
down_revision: str | Sequence[str] | None = "2743ef7700b3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "questions",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column("user_id", sa.BigInteger(), nullable=True),
        sa.Column("question_text", sa.Text(), nullable=False),
        sa.Column("topic_id", sa.BigInteger(), nullable=True),
        sa.Column("outcome", sa.String(length=20), nullable=False),
        sa.Column("confidence", sa.Double(), nullable=False),
        sa.Column("answer_text", sa.Text(), nullable=True),
        sa.Column("referred_office_id", sa.BigInteger(), nullable=True),
        sa.Column("model", sa.String(length=100), nullable=True),
        sa.Column("prompt_version", sa.String(length=40), nullable=False),
        sa.Column("latency_ms", sa.Integer(), nullable=False),
        sa.Column("parent_question_id", sa.BigInteger(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "outcome IN ('answered', 'referred', 'no_answer', 'error')",
            name=op.f("ck_questions_outcome_valid"),
        ),
        sa.ForeignKeyConstraint(
            ["parent_question_id"],
            ["questions.id"],
            name=op.f("fk_questions_parent_question_id_questions"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["referred_office_id"],
            ["offices.id"],
            name=op.f("fk_questions_referred_office_id_offices"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["topic_id"],
            ["topics.id"],
            name=op.f("fk_questions_topic_id_topics"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_questions_user_id_users"), ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_questions")),
    )
    op.create_index(op.f("ix_questions_created_at"), "questions", ["created_at"], unique=False)
    op.create_table(
        "question_citations",
        sa.Column("question_id", sa.BigInteger(), nullable=False),
        sa.Column("rank", sa.Integer(), nullable=False),
        sa.Column("chunk_id", sa.BigInteger(), nullable=True),
        sa.Column("document_id", sa.BigInteger(), nullable=False),
        sa.Column("score", sa.Double(), nullable=False),
        sa.Column("was_cited", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(
            ["chunk_id"],
            ["document_chunks.id"],
            name=op.f("fk_question_citations_chunk_id_document_chunks"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["document_id"],
            ["documents.id"],
            name=op.f("fk_question_citations_document_id_documents"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["question_id"],
            ["questions.id"],
            name=op.f("fk_question_citations_question_id_questions"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("question_id", "rank", name=op.f("pk_question_citations")),
    )
    op.create_index(
        op.f("ix_question_citations_document_id"),
        "question_citations",
        ["document_id"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_question_citations_document_id"), table_name="question_citations")
    op.drop_table("question_citations")
    op.drop_index(op.f("ix_questions_created_at"), table_name="questions")
    op.drop_table("questions")
