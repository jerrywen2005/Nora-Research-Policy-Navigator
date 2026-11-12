"""Shapes for the FAQ endpoints (docs/api.md, "FAQs" and "Admin: FAQs")."""

from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints

from app.schemas.admin_documents import UserRef
from app.schemas.content import DocumentRef, TopicRef, _FromOrm

Question = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]
Answer = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=10_000)]


class FaqOut(_FromOrm):
    """`Faq` in docs/api.md. The researcher endpoint loads only active documents as `sources`."""

    id: int
    question: str
    answer: str
    topic: TopicRef | None
    sources: list[DocumentRef] = Field(validation_alias="documents")
    updated_at: datetime


class AdminFaq(FaqOut):
    """`AdminFaq` in docs/api.md: a Faq plus what admins need, with every linked source."""

    status: Literal["draft", "published", "archived"]
    sort_order: int
    created_at: datetime
    # The ORM's `updated_by` is the user id column; the user itself is `updated_by_user`.
    updated_by: UserRef | None = Field(validation_alias="updated_by_user")


class CreateFaqRequest(BaseModel):
    question: Question
    answer: Answer
    topic_id: int | None = None
    document_ids: list[int] = []
    sort_order: int = 0


class UpdateFaqRequest(BaseModel):
    """Every field is optional: omitted fields stay as they are; document_ids replaces the list."""

    question: Question | None = None
    answer: Answer | None = None
    topic_id: int | None = None
    document_ids: list[int] | None = None
    sort_order: int | None = None
