"""ORM models. Import every model module here so Alembic autogenerate sees all tables."""

from app.models.content import DocType, Document, DocumentStatus, Office, Topic, document_topics
from app.models.tags import Tag, document_tags
from app.models.user import Role, User

__all__ = [
    "DocType",
    "Document",
    "DocumentStatus",
    "Office",
    "Role",
    "Tag",
    "Topic",
    "User",
    "document_tags",
    "document_topics",
]
