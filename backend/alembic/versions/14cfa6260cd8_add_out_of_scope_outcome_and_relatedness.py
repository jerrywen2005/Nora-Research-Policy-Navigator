"""add out_of_scope outcome and relatedness

Revision ID: 14cfa6260cd8
Revises: b66c25f7687d
Create Date: 2026-11-12 10:43:23.668227

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "14cfa6260cd8"
down_revision: str | Sequence[str] | None = "b66c25f7687d"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

OLD_OUTCOMES = "outcome IN ('answered', 'referred', 'no_answer', 'error')"
NEW_OUTCOMES = "outcome IN ('answered', 'referred', 'out_of_scope', 'no_answer', 'error')"


def upgrade() -> None:
    op.add_column("questions", sa.Column("relatedness", sa.Double(), nullable=True))
    op.drop_constraint(op.f("ck_questions_outcome_valid"), "questions", type_="check")
    op.create_check_constraint(op.f("ck_questions_outcome_valid"), "questions", NEW_OUTCOMES)


def downgrade() -> None:
    # The old constraint can't hold the new outcome; those questions were referrals, so keep
    # them as referrals.
    op.execute("UPDATE questions SET outcome = 'referred' WHERE outcome = 'out_of_scope'")
    op.drop_constraint(op.f("ck_questions_outcome_valid"), "questions", type_="check")
    op.create_check_constraint(op.f("ck_questions_outcome_valid"), "questions", OLD_OUTCOMES)
    op.drop_column("questions", "relatedness")
