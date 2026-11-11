"""add standard and procedure doc types

The UNC Policies knowledge base has policies, standards and procedures; the Link's inventory uses
all three.

Revision ID: 9f017b23450d
Revises: 6de3ee5b4d8c
Create Date: 2026-11-10 15:00:00.000000

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "9f017b23450d"
down_revision: str | Sequence[str] | None = "6de3ee5b4d8c"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

OLD = "'policy', 'sop', 'guidance', 'faq', 'webpage', 'job_aid', 'other'"
NEW = "'policy', 'standard', 'procedure', 'sop', 'guidance', 'faq', 'webpage', 'job_aid', 'other'"


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_constraint(op.f("ck_documents_doc_type_valid"), "documents", type_="check")
    op.create_check_constraint(
        op.f("ck_documents_doc_type_valid"), "documents", f"doc_type IN ({NEW})"
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.execute(
        "UPDATE documents SET doc_type = 'policy' WHERE doc_type IN ('standard', 'procedure')"
    )
    op.drop_constraint(op.f("ck_documents_doc_type_valid"), "documents", type_="check")
    op.create_check_constraint(
        op.f("ck_documents_doc_type_valid"), "documents", f"doc_type IN ({OLD})"
    )
