"""create users table

Revision ID: 6ddc0a734e48
Revises: 7fee7dd7b6ac
Create Date: 2026-10-12 13:54:28.568246

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "6ddc0a734e48"
down_revision: str | Sequence[str] | None = "7fee7dd7b6ac"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "users",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column("onyen", sa.String(length=64), nullable=False),
        sa.Column("display_name", sa.String(length=200), nullable=True),
        sa.Column("email", sa.String(length=320), nullable=True),
        sa.Column("role", sa.String(length=20), server_default="researcher", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("role IN ('researcher', 'admin')", name=op.f("ck_users_role_valid")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_users")),
        sa.UniqueConstraint("onyen", name=op.f("uq_users_onyen")),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table("users")
