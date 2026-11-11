"""Subtopic tags from the Link's tag inventory.

The 77 tags and their definitions are in data/policy_tags.json; each policy's tags are in
data/policy_inventory.json, with the rest of the seed. Both are generated from the Link's
spreadsheet; regenerate them from a newer inventory rather than editing them by hand. Documents
are matched to the inventory by Repository article id.
"""

import json
from dataclasses import dataclass
from functools import cache
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Document, Tag
from app.policy_repository import parse_article_id
from app.seed.content import CATEGORY_TOPICS, load_seed_documents

TAGS_FILE = Path(__file__).parent / "data" / "policy_tags.json"


@cache
def load_tag_definitions() -> list[dict]:
    """Every inventory tag as {"slug", "name", "definition"}."""
    return json.loads(TAGS_FILE.read_text(encoding="utf-8"))["tags"]


@dataclass
class InventoryPolicy:
    article_id: int
    topic_slug: str
    tag_names: list[str]


@cache
def _inventory_by_article() -> dict[int, dict]:
    return {data["article_id"]: data for data in load_seed_documents()}


def inventory_policy(article_id: int) -> InventoryPolicy | None:
    """The inventory's topic and tags for one article, or None if it isn't listed."""
    data = _inventory_by_article().get(article_id)
    if data is None:
        return None
    return InventoryPolicy(
        article_id=article_id,
        topic_slug=CATEGORY_TOPICS[data["category"]],
        tag_names=data["tags"],
    )


def seed_tags(session: Session) -> None:
    """Create or update every inventory tag, and tag the documents the inventory lists.

    Safe to run repeatedly. Does not commit. Tags are matched by slug. Run after seed_content.
    """
    tags_by_name: dict[str, Tag] = {}
    for data in load_tag_definitions():
        tag = session.scalars(select(Tag).where(Tag.slug == data["slug"])).one_or_none()
        if tag is None:
            tag = Tag(slug=data["slug"])
            session.add(tag)
        tag.name = data["name"]
        tag.definition = data["definition"]
        tags_by_name[tag.name] = tag

    for document in session.scalars(select(Document).where(Document.source_url.is_not(None))):
        article_id = parse_article_id(document.source_url)
        policy = inventory_policy(article_id) if article_id else None
        if policy is not None:
            document.tags = [tags_by_name[name] for name in policy.tag_names]
    session.flush()
