from sqlalchemy import BigInteger, Column, ForeignKey, Identity, String, Table, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base

# A document has up to five tags (the Link's limit, enforced by the admin API).
document_tags = Table(
    "document_tags",
    Base.metadata,
    Column(
        "document_id",
        BigInteger,
        ForeignKey("documents.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "tag_id",
        BigInteger,
        ForeignKey("tags.id", ondelete="CASCADE"),
        primary_key=True,
        index=True,
    ),
)


class Tag(Base):
    """A subtopic tag from the Link's tag inventory.

    Tags are one shared list of equally weighted labels: a tag isn't owned by a topic, and
    documents in any topic can carry it. See docs/decisions.md (2026-11-10).
    """

    __tablename__ = "tags"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    slug: Mapped[str] = mapped_column(String(200), unique=True)
    name: Mapped[str] = mapped_column(String(200), unique=True)
    # The Link's "when to use" text. Describes a discovery label, not a policy requirement.
    definition: Mapped[str | None] = mapped_column(Text)
