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


class LinkOut(BaseModel):
    title: str
    url: str


# What the researcher sees; the log also has "error", shown as "no_answer".
ShownOutcome = Literal["answered", "referred", "out_of_scope", "no_answer"]


class AskResponse(BaseModel):
    """`POST /api/ask` response in docs/api.md."""

    question_id: int
    outcome: ShownOutcome
    answer: str | None
    citations: list[CitationOut]
    # Who to contact, most specific first: the cited policies' offices then RCS for an answer,
    # or the one office a referral sends the user to.
    contacts: list[OfficeOut]
    confidence: float
    disclaimer: str | None  # with policy content only, not on a referral
    links: list[LinkOut]  # e.g. every UNC policy, for an out-of-scope question
