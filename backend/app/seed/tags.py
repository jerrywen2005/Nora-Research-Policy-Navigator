"""Subtopic tags from the Link's tag inventory (data/policy_tags.json).

The JSON is generated from the Link's spreadsheet; regenerate it from a newer inventory rather
than editing it by hand. Documents are matched to the inventory by Repository article id.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Document, Tag
from app.policy_repository import inventory_policy, load_inventory, parse_article_id


def seed_tags(session: Session) -> None:
    """Create or update every inventory tag, and tag the documents the inventory lists.

    Safe to run repeatedly. Does not commit. Tags are matched by slug. Run after seed_content.
    """
    tags_by_name: dict[str, Tag] = {}
    for data in load_inventory()["tags"]:
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
