from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.schemas.content import OfficeOut


class AskRequest(BaseModel):
    """`POST /api/ask` request in docs/api.md."""

    question: str = Field(min_length=1, max_length=1000)
    topic: str | None = Field(default=None, description="Topic slug that narrows retrieval")

    @field_validator("question")
    @classmethod
    def _not_blank(cls, question: str) -> str:
        question = question.strip()
        if not question:
            raise ValueError("Question must not be blank")
        return question


class CitationOut(BaseModel):
    """A numbered source; `[n]` in the answer refers to `number`."""

    number: int
    document_id: int
    title: str
    section: str
    source_url: str | None
    snippet: str


class AskResponse(BaseModel):
    """`POST /api/ask` response in docs/api.md."""

    question_id: int
    outcome: Literal["answered", "referred", "no_answer"]
    answer: str | None
    citations: list[CitationOut]
    referral: OfficeOut | None
    confidence: float
    disclaimer: str
