from datetime import date, datetime
from enum import StrEnum

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    Column,
    Computed,
    Date,
    DateTime,
    ForeignKey,
    Identity,
    Index,
    String,
    Table,
    Text,
    false,
    func,
    true,
)
from sqlalchemy.dialects.postgresql import TSVECTOR
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class DocType(StrEnum):
    POLICY = "policy"
    SOP = "sop"
    GUIDANCE = "guidance"
    FAQ = "faq"
    WEBPAGE = "webpage"
    JOB_AID = "job_aid"
    OTHER = "other"


class DocumentStatus(StrEnum):
    DRAFT = "draft"
    ACTIVE = "active"
    ARCHIVED = "archived"


def _in(values: type[StrEnum]) -> str:
    return ", ".join(f"'{v}'" for v in values)


class Office(Base):
    """A responsible office: owns documents and is where users get referred."""

    __tablename__ = "offices"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    name: Mapped[str] = mapped_column(String(200), unique=True)
    description: Mapped[str | None] = mapped_column(Text)
    email: Mapped[str | None] = mapped_column(String(320))
    phone: Mapped[str | None] = mapped_column(String(50))
    url: Mapped[str | None] = mapped_column(String(2000))


# A document can belong to several topics.
document_topics = Table(
    "document_topics",
    Base.metadata,
    Column(
        "document_id",
        BigInteger,
        ForeignKey("documents.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "topic_id",
        BigInteger,
        ForeignKey("topics.id", ondelete="CASCADE"),
        primary_key=True,
        index=True,
    ),
)


class Topic(Base):
    """The shared taxonomy for browsing documents and, later, classifying questions."""

    __tablename__ = "topics"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    slug: Mapped[str] = mapped_column(String(100), unique=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="", server_default="")
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("topics.id"))
    default_office_id: Mapped[int | None] = mapped_column(ForeignKey("offices.id"))
    sort_order: Mapped[int] = mapped_column(default=0, server_default="0")
    is_active: Mapped[bool] = mapped_column(default=True, server_default=true())

    default_office: Mapped[Office | None] = relationship()


class Document(Base):
    """One source document. Only active documents are shown; archived ones are kept, not deleted."""

    __tablename__ = "documents"
    __table_args__ = (
        CheckConstraint(f"doc_type IN ({_in(DocType)})", name="doc_type_valid"),
        CheckConstraint(f"status IN ({_in(DocumentStatus)})", name="status_valid"),
        Index("ix_documents_search_vector", "search_vector", postgresql_using="gin"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    title: Mapped[str] = mapped_column(String(500))
    doc_type: Mapped[str] = mapped_column(String(20))
    citation: Mapped[str | None] = mapped_column(String(200))
    source_url: Mapped[str | None] = mapped_column(String(2000))
    summary: Mapped[str | None] = mapped_column(Text)
    content_text: Mapped[str] = mapped_column(Text, default="", server_default="")
    # sha256 of content_text; detects changed or duplicate uploads.
    content_hash: Mapped[str | None] = mapped_column(String(64))
    office_id: Mapped[int | None] = mapped_column(ForeignKey("offices.id"))
    status: Mapped[str] = mapped_column(
        String(20), default=DocumentStatus.DRAFT, server_default="draft"
    )
    # Only authoritative, active documents will be used for answers.
    is_authoritative: Mapped[bool] = mapped_column(default=False, server_default=false())
    replaced_by_id: Mapped[int | None] = mapped_column(ForeignKey("documents.id"))
    effective_date: Mapped[date | None] = mapped_column(Date)
    last_reviewed_at: Mapped[date | None] = mapped_column(Date)
    review_due_at: Mapped[date | None] = mapped_column(Date)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    updated_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    # Keyword search. Title matches rank above summary matches, which rank above body matches.
    search_vector: Mapped[str] = mapped_column(
        TSVECTOR,
        Computed(
            "setweight(to_tsvector('english', coalesce(title, '')), 'A') || "
            "setweight(to_tsvector('english', coalesce(summary, '')), 'B') || "
            "setweight(to_tsvector('english', coalesce(content_text, '')), 'C')",
            persisted=True,
        ),
        deferred=True,
    )

    office: Mapped[Office | None] = relationship()
    topics: Mapped[list[Topic]] = relationship(
        secondary=document_topics, order_by=lambda: (Topic.sort_order, Topic.name)
    )
