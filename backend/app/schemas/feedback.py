from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.feedback import COMMENT_MAX_LENGTH
from app.schemas.ask import CitationOut, LinkOut, ShownOutcome
from app.schemas.content import DocumentSummary, OfficeOut


class FeedbackRequest(BaseModel):
    """`PUT /api/questions/{question_id}/feedback` request in docs/api.md."""

    helpful: bool
    comment: str | None = Field(default=None, max_length=COMMENT_MAX_LENGTH)

    @field_validator("comment")
    @classmethod
    def _blank_is_null(cls, comment: str | None) -> str | None:
        if comment is None:
            return None
        return comment.strip() or None


class FeedbackOut(BaseModel):
    """`Feedback` in docs/api.md."""

    model_config = ConfigDict(from_attributes=True)

    question_id: int
    helpful: bool
    comment: str | None
    created_at: datetime
    updated_at: datetime


# ---- Saved items ----


class SaveRequest(BaseModel):
    """`POST /api/saved` request in docs/api.md: exactly one of the two ids."""

    document_id: int | None = None
    question_id: int | None = None

    @model_validator(mode="after")
    def _exactly_one(self) -> "SaveRequest":
        if (self.document_id is None) == (self.question_id is None):
            raise ValueError("Send exactly one of document_id and question_id")
        return self


class SavedQuestion(BaseModel):
    """`SavedItem.question` in docs/api.md."""

    id: int
    question_text: str
    outcome: ShownOutcome
    answer_text: str | None
    # What the Ask page showed with the answer, rebuilt the same way (app/rag/answer.py).
    citations: list[CitationOut]
    contacts: list[OfficeOut]
    disclaimer: str | None
    links: list[LinkOut]
    created_at: datetime


class SavedItemOut(BaseModel):
    """`SavedItem` in docs/api.md. Exactly one of `document` and `question` is set."""

    id: int
    created_at: datetime
    kind: Literal["document", "question"]
    document: DocumentSummary | None
    question: SavedQuestion | None
