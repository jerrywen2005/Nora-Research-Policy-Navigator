from datetime import datetime
from enum import StrEnum

from sqlalchemy import BigInteger, CheckConstraint, DateTime, Identity, String, func, true
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Role(StrEnum):
    RESEARCHER = "researcher"
    ADMIN = "admin"


class User(Base):
    """A person who has signed in. The role comes from here, never from the identity provider."""

    __tablename__ = "users"
    __table_args__ = (CheckConstraint("role IN ('researcher', 'admin')", name="role_valid"),)

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    # Stored lowercase. Comes from SSO later; the mock login supplies it for now.
    onyen: Mapped[str] = mapped_column(String(64), unique=True)
    display_name: Mapped[str | None] = mapped_column(String(200))
    email: Mapped[str | None] = mapped_column(String(320))
    role: Mapped[str] = mapped_column(
        String(20), default=Role.RESEARCHER, server_default="researcher"
    )
    is_active: Mapped[bool] = mapped_column(default=True, server_default=true())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
