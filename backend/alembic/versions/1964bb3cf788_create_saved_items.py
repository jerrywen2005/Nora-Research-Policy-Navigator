"""create saved items

Revision ID: 1964bb3cf788
Revises: f31dd62e0247
Create Date: 2026-11-11 14:20:28.692788

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "1964bb3cf788"
down_revision: str | Sequence[str] | None = "f31dd62e0247"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "saved_items",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("document_id", sa.BigInteger(), nullable=True),
        sa.Column("question_id", sa.BigInteger(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "num_nonnulls(document_id, question_id) = 1", name=op.f("ck_saved_items_one_target")
        ),
        sa.ForeignKeyConstraint(
            ["document_id"],
            ["documents.id"],
            name=op.f("fk_saved_items_document_id_documents"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["question_id"],
            ["questions.id"],
            name=op.f("fk_saved_items_question_id_questions"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_saved_items_user_id_users"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_saved_items")),
    )
    op.create_index(
        op.f("ix_saved_items_document_id"), "saved_items", ["document_id"], unique=False
    )
    op.create_index(
        op.f("ix_saved_items_question_id"), "saved_items", ["question_id"], unique=False
    )
    op.create_index(op.f("ix_saved_items_user_id"), "saved_items", ["user_id"], unique=False)
    op.create_index(
        "uq_saved_items_user_document",
        "saved_items",
        ["user_id", "document_id"],
        unique=True,
        postgresql_where="document_id IS NOT NULL",
    )
    op.create_index(
        "uq_saved_items_user_question",
        "saved_items",
        ["user_id", "question_id"],
        unique=True,
        postgresql_where="question_id IS NOT NULL",
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(
        "uq_saved_items_user_question",
        table_name="saved_items",
        postgresql_where="question_id IS NOT NULL",
    )
    op.drop_index(
        "uq_saved_items_user_document",
        table_name="saved_items",
        postgresql_where="document_id IS NOT NULL",
    )
    op.drop_index(op.f("ix_saved_items_user_id"), table_name="saved_items")
    op.drop_index(op.f("ix_saved_items_question_id"), table_name="saved_items")
    op.drop_index(op.f("ix_saved_items_document_id"), table_name="saved_items")
    op.drop_table("saved_items")
