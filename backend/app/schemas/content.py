from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, field_validator


class _FromOrm(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class OfficeOut(_FromOrm):
    """`Office` in docs/api.md."""

    id: int
    name: str
    email: str | None
    phone: str | None
    url: str | None


class TopicRef(_FromOrm):
    """`TopicRef` in frontend/src/api/types.ts: the short form listed on a document."""

    id: int
    slug: str
    name: str


class TopicOut(TopicRef):
    """`Topic` in docs/api.md."""

    description: str
    document_count: int


class TopicDetail(TopicOut):
    """`TopicDetail` in docs/api.md: a Topic plus the office that handles referrals for it."""

    office: OfficeOut | None


class DocumentSummary(_FromOrm):
    """`DocumentSummary` in docs/api.md."""

    id: int
    title: str
    doc_type: Literal["policy", "sop", "guidance", "faq", "webpage", "job_aid", "other"]
    citation: str | None
    source_url: str | None
    summary: str | None
    office: OfficeOut | None
    topics: list[TopicRef]
    is_authoritative: bool
    last_reviewed_at: date | None

    @field_validator("topics", mode="before")
    @classmethod
    def _only_active_topics(cls, topics: list) -> list:
        return [t for t in topics if getattr(t, "is_active", True)]


class DocumentDetail(DocumentSummary):
    """`DocumentDetail` in docs/api.md."""

    content_text: str


class DocumentPage(BaseModel):
    """The `GET /api/documents` response: one page of results and the total match count."""

    items: list[DocumentSummary]
    total: int
