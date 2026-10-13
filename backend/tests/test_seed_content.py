from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Document, DocumentStatus, Office, Topic
from app.seed.content import SEED_OFFICES, SEED_TOPICS, load_seed_documents, seed_content


def test_seed_data_references_known_offices_and_topics():
    slugs = {t["slug"] for t in SEED_TOPICS}
    documents = load_seed_documents()

    assert len(documents) >= 15
    assert len({d["source_url"] for d in documents}) == len(documents)
    for document in documents:
        assert document["office"] in SEED_OFFICES
        assert document["topics"] and set(document["topics"]) <= slugs
        assert document["source_url"].startswith("https://policies.unc.edu/")
        assert document["summary"] and document["content_text"]
    assert {t["office"] for t in SEED_TOPICS} <= SEED_OFFICES.keys()
    # Every topic has something to browse.
    assert {slug for d in documents for slug in d["topics"]} == slugs


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
        assert document.topics
        assert len(document.content_hash) == 64
