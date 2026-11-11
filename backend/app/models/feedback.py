from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, Identity, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base

COMMENT_MAX_LENGTH = 1000


class Feedback(Base):
    """A helpful / not-helpful rating on an answer (F7). Only the user who asked can rate it."""

    __tablename__ = "feedback"
    __table_args__ = (
        # One rating per user per question, so PUT upserts. Named explicitly: the default
        # convention only uses the first column.
        UniqueConstraint("question_id", "user_id", name="uq_feedback_question_id_user_id"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id", ondelete="CASCADE"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    helpful: Mapped[bool]
    comment: Mapped[str | None] = mapped_column(String(COMMENT_MAX_LENGTH))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    # Equal to created_at until the rating is replaced (see app/api/feedback.py).
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
