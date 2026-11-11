"""Shapes for the admin content-management endpoints (docs/api.md, "Admin: content management")."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.models import DocType
from app.schemas.content import DocumentSummary, _FromOrm

MAX_TAGS_PER_DOCUMENT = 5  # the Link's tag inventory allows up to five tags per policy


class UserRef(_FromOrm):
    id: int
    onyen: str
    display_name: str | None


class AdminDocument(DocumentSummary):
    """`AdminDocument` in docs/api.md: a DocumentSummary plus what admins need."""

    status: Literal["draft", "active", "archived"]
    created_at: datetime
    updated_at: datetime
    # The ORM's `updated_by` is the user id column; the user itself is `updated_by_user`.
    updated_by: UserRef | None = Field(validation_alias="updated_by_user")


class AdminDocumentDetail(AdminDocument):
    """`AdminDocumentDetail` in docs/api.md."""

    content_text: str


class AdminDocumentPage(BaseModel):
    items: list[AdminDocument]
    total: int


class ImportDocumentRequest(BaseModel):
    source_url: str = Field(max_length=2000)


class UpdateDocumentRequest(BaseModel):
    """Every field is optional: omitted fields stay as they are, and lists replace the list."""

    doc_type: DocType | None = None
    office_id: int | None = None
    topic_ids: list[int] | None = None
    tag_ids: list[int] | None = Field(default=None, max_length=MAX_TAGS_PER_DOCUMENT)
    is_authoritative: bool | None = None
