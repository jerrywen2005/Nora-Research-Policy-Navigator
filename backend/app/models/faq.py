from datetime import datetime
from enum import StrEnum

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Identity,
    Index,
    String,
    Table,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.content import Document, Topic, _in


class FaqStatus(StrEnum):
    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"


# The policies an FAQ's answer is based on.
faq_documents = Table(
    "faq_documents",
    Base.metadata,
    Column("faq_id", BigInteger, ForeignKey("faqs.id", ondelete="CASCADE"), primary_key=True),
    Column(
        "document_id",
        BigInteger,
        ForeignKey("documents.id", ondelete="CASCADE"),
        primary_key=True,
        index=True,
    ),
)


class Faq(Base):
    """A question and answer written by an admin (F8). Researchers only see published ones."""

    __tablename__ = "faqs"
    __table_args__ = (
        CheckConstraint(f"status IN ({_in(FaqStatus)})", name="status_valid"),
        Index("ix_faqs_status_topic_id", "status", "topic_id"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    question: Mapped[str] = mapped_column(String(500))
    # Markdown, rendered with the same safe renderer as Ask answers.
    answer: Mapped[str] = mapped_column(Text)
    # Topics aren't deleted in the app; if one is, its FAQs lose the topic for an admin to reassign.
    topic_id: Mapped[int | None] = mapped_column(ForeignKey("topics.id", ondelete="SET NULL"))
    status: Mapped[str] = mapped_column(String(20), default=FaqStatus.DRAFT, server_default="draft")
    sort_order: Mapped[int] = mapped_column(default=0, server_default="0")
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    updated_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    topic: Mapped[Topic | None] = relationship()
    documents: Mapped[list[Document]] = relationship(
        secondary=faq_documents, order_by=Document.title
    )
    updated_by_user: Mapped["User | None"] = relationship(foreign_keys=[updated_by])  # noqa: F821
