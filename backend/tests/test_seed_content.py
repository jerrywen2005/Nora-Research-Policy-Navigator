from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import DocType, Document, DocumentStatus, Office, Topic
from app.seed.content import (
    CATEGORY_TOPICS,
    LEGACY_URL,
    SEED_OFFICES,
    SEED_TOPICS,
    UNIT_OFFICES,
    load_seed_documents,
    seed_content,
)


def test_inventory_maps_onto_known_topics_and_offices():
    slugs = {t["slug"] for t in SEED_TOPICS}
    documents = load_seed_documents()

    # The Link's inventory (2026-10-28) lists 197 policies.
    assert len(documents) == 197
    assert len({d["source_url"] for d in documents}) == len(documents)
    assert len({d["article_id"] for d in documents}) == len(documents)
    assert set(CATEGORY_TOPICS.values()) == slugs
    assert set(UNIT_OFFICES.values()) <= SEED_OFFICES.keys()
    assert {t["office"] for t in SEED_TOPICS} <= SEED_OFFICES.keys()
    for document in documents:
        assert document["category"] in CATEGORY_TOPICS
        assert document["responsible_unit"] is None or document["responsible_unit"] in UNIT_OFFICES
        assert document["doc_type"] in set(DocType)
        assert document["source_url"].startswith("https://policies.unc.edu/")
        assert f"/Article/{document['article_id']}" in document["source_url"]
        assert len(document["tags"]) <= 5
    # Every topic has something to browse.
    assert {CATEGORY_TOPICS[d["category"]] for d in documents} == slugs


def test_seed_content_creates_and_is_idempotent(db_session: Session, content):
    # `content` starts from empty tables, so the first run creates and the second updates.
    seed_content(db_session)
    seed_content(db_session)

    assert db_session.scalar(select(func.count()).select_from(Office)) == len(SEED_OFFICES)
    assert db_session.scalars(select(Topic.slug).order_by(Topic.sort_order)).all() == [
        t["slug"] for t in SEED_TOPICS
    ]
    documents = db_session.scalars(select(Document)).all()
    assert len(documents) == len(load_seed_documents())
    for document in documents:
        assert document.status == DocumentStatus.ACTIVE
        assert document.is_authoritative
        assert document.office is not None
        assert len(document.topics) == 1
        assert len(document.content_hash) == 64


def test_seed_content_uses_the_responsible_unit_then_the_topic_office(db_session: Session, content):
    seed_content(db_session)
    by_url = {d["source_url"]: d for d in load_seed_documents()}

    for document in db_session.scalars(select(Document)).all():
        data = by_url[document.source_url]
        topic = next(t for t in SEED_TOPICS if t["slug"] == CATEGORY_TOPICS[data["category"]])
        expected = UNIT_OFFICES.get(data["responsible_unit"]) or topic["office"]
        assert document.office.name == SEED_OFFICES[expected]["name"]


def test_seed_content_updates_rows_stored_under_the_legacy_url(db_session: Session, content):
    data = load_seed_documents()[0]
    legacy = content.document("Old title", source_url=LEGACY_URL.format(data["article_id"]))

    seed_content(db_session)

    db_session.refresh(legacy)
    assert legacy.source_url == data["source_url"]
    assert legacy.title == data["title"]
    assert db_session.scalar(select(func.count()).select_from(Document)) == len(
        load_seed_documents()
    )
