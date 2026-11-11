import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Document, DocumentStatus, Tag
from app.seed.content import load_seed_documents, seed_content
from app.seed.tags import inventory_policy, load_tag_definitions, seed_tags
from tests.conftest import login


@pytest.fixture
def signed_in(client: TestClient) -> TestClient:
    login(client, "researcher1")
    return client


def titles(response) -> list[str]:
    assert response.status_code == 200, response.text
    return [item["title"] for item in response.json()["items"]]


# ---- Seed ----


def test_seed_tags_loads_the_inventory_and_tags_seeded_documents(db_session: Session, content):
    seed_content(db_session)
    unlisted = content.document("Not in the inventory", source_url="https://policies.test/1")
    no_link = content.document("No link")

    seed_tags(db_session)
    seed_tags(db_session)  # idempotent

    assert db_session.scalar(select(func.count()).select_from(Tag)) == len(load_tag_definitions())
    # The inventory gives 132183 one tag.
    animal = db_session.scalars(
        select(Document).where(Document.source_url.contains("132183"))
    ).one()
    assert [tag.name for tag in animal.tags] == ["IACUC Oversight & Protocols"]
    tagged = db_session.scalars(select(Document).where(Document.tags.any())).all()
    assert len(tagged) == len([d for d in load_seed_documents() if d["tags"]])
    assert unlisted.tags == [] and no_link.tags == []


def test_inventory_is_consistent():
    tags = load_tag_definitions()
    tag_names = {tag["name"] for tag in tags}

    assert len({tag["slug"] for tag in tags}) == len(tags)
    for policy in load_seed_documents():
        assert len(policy["tags"]) <= 5
        assert set(policy["tags"]) <= tag_names


def test_inventory_policy():
    policy = inventory_policy(132183)

    assert policy.topic_slug == "animal-care-and-use"
    assert policy.tag_names == ["IACUC Oversight & Protocols"]
    assert inventory_policy(1) is None


# ---- GET /api/tags and /api/offices ----


def test_tags_and_offices_require_login(client: TestClient):
    assert client.get("/api/tags").status_code == 401
    assert client.get("/api/offices").status_code == 401


def test_list_tags_by_name(signed_in: TestClient, content):
    b = content.tag("B Tag", definition="When to use B.")
    a = content.tag("A Tag")

    response = signed_in.get("/api/tags")

    assert response.status_code == 200
    assert response.json() == [
        {"id": a.id, "slug": "a-tag", "name": "A Tag", "definition": None},
        {"id": b.id, "slug": "b-tag", "name": "B Tag", "definition": "When to use B."},
    ]


def test_list_offices_by_name(signed_in: TestClient, content):
    content.office("Zeta Office")
    alpha = content.office("Alpha Office", email="a@example.edu")

    body = signed_in.get("/api/offices").json()

    assert [office["name"] for office in body] == ["Alpha Office", "Zeta Office"]
    assert body[0] == {
        "id": alpha.id,
        "name": "Alpha Office",
        "email": "a@example.edu",
        "phone": None,
        "url": None,
    }


# ---- Topic tags ----


def test_topic_tags_come_from_its_active_documents(signed_in: TestClient, content):
    topic = content.topic("testing", sort_order=1)
    other = content.topic("other", sort_order=2)
    shared, second, archived_only, elsewhere = (
        content.tag(name) for name in ("Shared", "Second", "Archived Only", "Elsewhere")
    )
    content.document("One", topics=[topic], tags=[shared, second])
    content.document("Two", topics=[topic], tags=[shared])
    content.document("Old", topics=[topic], tags=[archived_only], status=DocumentStatus.ARCHIVED)
    content.document("Three", topics=[other], tags=[elsewhere, shared])

    topics = signed_in.get("/api/topics").json()
    detail = signed_in.get("/api/topics/testing").json()

    assert [tag["name"] for tag in topics[0]["tags"]] == ["Second", "Shared"]
    assert [tag["name"] for tag in topics[1]["tags"]] == ["Elsewhere", "Shared"]
    assert detail["tags"] == topics[0]["tags"]
    assert detail["tags"][0] == {
        "id": second.id,
        "slug": "second",
        "name": "Second",
        "definition": None,
    }


# ---- Documents: tag filter, name search, related documents ----


def test_filter_by_tag_across_topics_or_within_one(signed_in: TestClient, content):
    topic = content.topic("testing")
    other = content.topic("other")
    tag = content.tag("Roles")
    content.document("In topic", topics=[topic], tags=[tag])
    content.document("Other topic", topics=[other], tags=[tag])
    content.document("Untagged", topics=[topic])

    assert titles(signed_in.get("/api/documents?tag=roles")) == ["In topic", "Other topic"]
    assert titles(signed_in.get("/api/documents?tag=roles&topic=testing")) == ["In topic"]
    assert titles(signed_in.get("/api/documents?tag=unknown")) == []


def test_documents_list_their_tags(signed_in: TestClient, content):
    b, a = content.tag("B Tag"), content.tag("A Tag")
    content.document("Tagged", tags=[b, a])

    item = signed_in.get("/api/documents").json()["items"][0]

    assert [tag["name"] for tag in item["tags"]] == ["A Tag", "B Tag"]


def test_search_matches_topic_and_tag_names(signed_in: TestClient, content):
    topic = content.topic("animals", name="Animal Care")
    retired = content.topic("retired", name="Retired Zebra Topic", is_active=False)
    tag = content.tag("Humane Endpoints")
    content.document("Tagged one", tags=[tag])
    content.document("In topic", topics=[topic])
    content.document("Retired topic only", topics=[retired])
    content.document("Unrelated")

    assert titles(signed_in.get("/api/documents?q=humane endpoints")) == ["Tagged one"]
    assert titles(signed_in.get("/api/documents?q=animal")) == ["In topic"]
    # Every word must match, but the words may come from different fields.
    assert titles(signed_in.get("/api/documents?q=tagged humane")) == ["Tagged one"]
    # Inactive topics' names aren't searched.
    assert titles(signed_in.get("/api/documents?q=zebra")) == []


def test_document_detail_lists_related_documents(signed_in: TestClient, content):
    a, b, c = content.tag("A"), content.tag("B"), content.tag("C")
    document = content.document("Main", tags=[a, b, c])
    content.document("Shares two", tags=[a, b], citation="REL 1")
    for title in ("Shares one E", "Shares one D", "Shares one C", "Shares one B", "Shares one A"):
        content.document(title, tags=[c])
    content.document("Archived", tags=[a, b, c], status=DocumentStatus.ARCHIVED)
    content.document("Unrelated")

    related = signed_in.get(f"/api/documents/{document.id}").json()["related_documents"]

    assert [r["title"] for r in related] == [
        "Shares two",
        "Shares one A",
        "Shares one B",
        "Shares one C",
        "Shares one D",
    ]
    assert set(related[0]) == {"id", "title", "doc_type", "citation"}
    assert related[0]["citation"] == "REL 1"


def test_document_without_tags_has_no_related_documents(signed_in: TestClient, content):
    document = content.document("Alone")

    assert signed_in.get(f"/api/documents/{document.id}").json()["related_documents"] == []
