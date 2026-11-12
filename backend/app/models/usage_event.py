from datetime import datetime
from enum import StrEnum

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Identity,
    Index,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class EventType(StrEnum):
    LOGIN = "login"
    TOPIC_VIEW = "topic_view"
    DOCUMENT_VIEW = "document_view"
    SEARCH = "search"


class UsageEvent(Base):
    """One logged interaction that isn't an Ask (Asks are in `questions`). For the dashboard.

    Written by app/analytics/logging.py. Every foreign key is SET NULL, so deleting a user, topic
    or document keeps the counts.
    """

    __tablename__ = "usage_events"
    __table_args__ = (
        CheckConstraint(
            f"event_type IN ({', '.join(repr(str(e)) for e in EventType)})",
            name="event_type_valid",
        ),
        Index("ix_usage_events_event_type_created_at", "event_type", "created_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    event_type: Mapped[str] = mapped_column(String(20))
    topic_id: Mapped[int | None] = mapped_column(ForeignKey("topics.id", ondelete="SET NULL"))
    document_id: Mapped[int | None] = mapped_column(ForeignKey("documents.id", ondelete="SET NULL"))
    # Searches only: the text, trimmed and lowercased, and the total number of matches.
    query: Mapped[str | None] = mapped_column(Text)
    result_count: Mapped[int | None]
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
