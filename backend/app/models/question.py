from datetime import datetime
from enum import StrEnum

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Identity,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.content import Document, DocumentChunk, Office


class Outcome(StrEnum):
    ANSWERED = "answered"  # an answer that cites the policies
    REFERRED = "referred"  # about research, but no policy covers it; sent to RCS
    OUT_OF_SCOPE = "out_of_scope"  # not about research; sent to the University Policy Office
    NO_ANSWER = "no_answer"  # relevant sources, but they don't support an answer
    ERROR = "error"  # the LLM call failed; the user got the sources and a referral


class Question(Base):
    """One Ask. Logged for the admin dashboard and so feedback can refer to it."""

    __tablename__ = "questions"
    __table_args__ = (
        CheckConstraint(
            f"outcome IN ({', '.join(repr(str(o)) for o in Outcome)})", name="outcome_valid"
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    # Nullable so questions can be anonymized later (open privacy question in decisions.md).
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    question_text: Mapped[str] = mapped_column(Text)
    # The topic the user asked from, if any.
    topic_id: Mapped[int | None] = mapped_column(ForeignKey("topics.id", ondelete="SET NULL"))
    outcome: Mapped[str] = mapped_column(String(20))
    # The best reranker score, 0 to 1; the gate compares it with the threshold.
    confidence: Mapped[float]
    # Cosine similarity of the closest chunk, -1 to 1: how close the question is to the policies'
    # subject at all. Decides referred vs out_of_scope when there's no LLM. Null before 2026-11-12.
    relatedness: Mapped[float | None]
    answer_text: Mapped[str | None] = mapped_column(Text)
    referred_office_id: Mapped[int | None] = mapped_column(
        ForeignKey("offices.id", ondelete="SET NULL")
    )
    model: Mapped[str | None] = mapped_column(String(100))
    prompt_version: Mapped[str] = mapped_column(String(40))
    latency_ms: Mapped[int]
    parent_question_id: Mapped[int | None] = mapped_column(
        ForeignKey("questions.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )

    referred_office: Mapped[Office | None] = relationship()
    citations: Mapped[list["QuestionCitation"]] = relationship(
        back_populates="question",
        order_by="QuestionCitation.rank",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class QuestionCitation(Base):
    """A chunk retrieved for a question, and whether the answer cited it.

    Stores document_id too, so "most cited resources" still counts after re-chunking deletes the
    chunk.
    """

    __tablename__ = "question_citations"

    question_id: Mapped[int] = mapped_column(
        ForeignKey("questions.id", ondelete="CASCADE"), primary_key=True
    )
    rank: Mapped[int] = mapped_column(primary_key=True)  # 1 = best
    chunk_id: Mapped[int | None] = mapped_column(
        ForeignKey("document_chunks.id", ondelete="SET NULL")
    )
    document_id: Mapped[int] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"), index=True
    )
    score: Mapped[float]
    was_cited: Mapped[bool]

    question: Mapped[Question] = relationship(back_populates="citations")
    # Null once re-chunking deletes the chunk; `document` stays.
    chunk: Mapped[DocumentChunk | None] = relationship()
    document: Mapped[Document] = relationship()
