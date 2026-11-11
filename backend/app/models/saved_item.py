from datetime import datetime

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, Identity, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.content import Document
from app.models.question import Question


class SavedItem(Base):
    """A document or one of the user's own questions, saved for later (F9)."""

    __tablename__ = "saved_items"
    __table_args__ = (
        CheckConstraint("num_nonnulls(document_id, question_id) = 1", name="one_target"),
        # A user saves each thing once; POST returns the existing item for a repeat save.
        Index(
            "uq_saved_items_user_document",
            "user_id",
            "document_id",
            unique=True,
            postgresql_where="document_id IS NOT NULL",
        ),
        Index(
            "uq_saved_items_user_question",
            "user_id",
            "question_id",
            unique=True,
            postgresql_where="question_id IS NOT NULL",
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    document_id: Mapped[int | None] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"), index=True
    )
    question_id: Mapped[int | None] = mapped_column(
        ForeignKey("questions.id", ondelete="CASCADE"), index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    document: Mapped[Document | None] = relationship()
    question: Mapped[Question | None] = relationship()
