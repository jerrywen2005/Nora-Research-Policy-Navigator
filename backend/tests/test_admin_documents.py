from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Document, DocumentStatus, Role
from app.policy_repository import RepositoryError, get_repository_client, official_url
from tests.conftest import login

ARTICLE_URL = official_url(132183)  # in the Link's inventory: animal-care-and-use, one tag
PAGE = (
    '<h1 class="gutter-top">Imported Policy</h1>'
    '<div id="ctl00_ctl00_cpContent_cpContent_divBody"><h2>Purpose</h2><p>Text.</p></div>'
)


class FakeRepository:
    def __init__(self, html: str = PAGE, error: bool = False) -> None:
        self.html, self.error, self.fetched = html, error, []

    def fetch_article(self, article_id: int) -> str:
        self.fetched.append(article_id)
        if self.error:
            raise RepositoryError("Couldn't fetch")
        return self.html


@pytest.fixture
def admin(client: TestClient, make_user) -> TestClient:
    make_user("admin-tester", role=Role.ADMIN)
    login(client, "admin-tester")
    return client


@pytest.fixture
def repository(client: TestClient) -> FakeRepository:
    fake = FakeRepository()
    client.app.dependency_overrides[get_repository_client] = lambda: fake
    return fake


@pytest.fixture
def ready(content):
    """A draft with everything it needs to be published."""
    office = content.office("Office of Testing")
    topic = content.topic("testing")
    document = content.document("Draft", topics=[topic], office=office, status=DocumentStatus.DRAFT)
    return document


# ---- Access ----


def test_admin_documents_need_the_admin_role(client: TestClient, content):
    document = content.document("Doc")
    paths = [
        ("get", "/api/admin/documents"),
        ("get", f"/api/admin/documents/{document.id}"),
        ("post", "/api/admin/documents"),
        ("patch", f"/api/admin/documents/{document.id}"),
        ("post", f"/api/admin/documents/{document.id}/publish"),
        ("post", f"/api/admin/documents/{document.id}/archive"),
        ("post", f"/api/admin/documents/{document.id}/restore"),
        ("delete", f"/api/admin/documents/{document.id}?confirm=true"),
    ]
    for method, path in paths:
        assert client.request(method, path).status_code == 401, path
    login(client, "researcher1")
    for method, path in paths:
        assert client.request(method, path).status_code == 403, path


# ---- List and detail ----


def test_list_shows_every_status_newest_first(admin: TestClient, content):
    content.document("Active", updated_at=datetime(2026, 1, 1, tzinfo=UTC))
    content.document(
        "Draft", status=DocumentStatus.DRAFT, updated_at=datetime(2026, 2, 1, tzinfo=UTC)
    )
    content.document(
        "Archived", status=DocumentStatus.ARCHIVED, updated_at=datetime(2026, 3, 1, tzinfo=UTC)
    )

    body = admin.get("/api/admin/documents").json()

    assert body["total"] == 3
    assert body["items"][0]["title"] == "Archived"
    assert {item["status"] for item in body["items"]} == {"active", "draft", "archived"}


def test_list_filters_by_status_topic_and_keywords(admin: TestClient, content):
    topic = content.topic("testing")
    content.document("Consent draft", topics=[topic], status=DocumentStatus.DRAFT)
    content.document("Consent active", topics=[topic])
    content.document("Other draft", status=DocumentStatus.DRAFT)

    def titles(query: str) -> list[str]:
        response = admin.get(f"/api/admin/documents?{query}")
        assert response.status_code == 200, response.text
        return sorted(item["title"] for item in response.json()["items"])

    assert titles("status=draft") == ["Consent draft", "Other draft"]
    assert titles("status=draft&topic=testing") == ["Consent draft"]
    assert titles("q=%20consent%20") == ["Consent active", "Consent draft"]
    assert admin.get("/api/admin/documents?status=deleted").status_code == 422


def test_detail_matches_the_api_contract(admin: TestClient, ready):
    response = admin.get(f"/api/admin/documents/{ready.id}")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "draft"
    assert body["content_text"] == ""
    assert body["updated_by"] is None
    assert body["tags"] == []
    assert {"created_at", "updated_at"} <= body.keys()
    assert admin.get("/api/admin/documents/999999999").status_code == 404


# ---- Import ----


def test_import_creates_a_draft_from_the_inventory(admin: TestClient, repository, content):
    topic = content.topic("animal-care-and-use")
    tag = content.tag("IACUC Oversight & Protocols")
    content.tag("Unrelated")

    response = admin.post(
        "/api/admin/documents",
        json={
            "source_url": "https://policies.unc.edu/TDClient/2833/Portal/KB/ArticleDet?ID=132183"
        },
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert repository.fetched == [132183]
    assert body["title"] == "Imported Policy"
    assert body["content_text"] == "## Purpose\n\nText."
    assert body["source_url"] == ARTICLE_URL
    assert body["status"] == "draft"
    assert body["doc_type"] == "other"
    assert body["is_authoritative"] is False
    assert body["office"] is None
    assert [t["id"] for t in body["topics"]] == [topic.id]
    assert [t["id"] for t in body["tags"]] == [tag.id]
    assert body["updated_by"]["onyen"] == "admin-tester"


def test_import_of_an_article_not_in_the_inventory(admin: TestClient, repository, content):
    response = admin.post("/api/admin/documents", json={"source_url": official_url(1)})

    assert response.status_code == 201, response.text
    assert response.json()["topics"] == [] and response.json()["tags"] == []


def test_import_rejects_other_links(admin: TestClient, repository):
    response = admin.post("/api/admin/documents", json={"source_url": "https://example.com/x"})

    assert response.status_code == 422
    assert repository.fetched == []


def test_import_rejects_an_article_already_loaded(admin: TestClient, repository, content):
    content.document("Similar id", source_url=official_url(1321830))
    existing = content.document(
        "Seeded", source_url="https://policies.unc.edu/TDClient/2833/Portal/KB/ArticleDet?ID=132183"
    )

    response = admin.post("/api/admin/documents", json={"source_url": ARTICLE_URL})

    assert response.status_code == 409
    assert str(existing.id) in response.json()["detail"]
    assert repository.fetched == []


@pytest.mark.parametrize("fake", [FakeRepository(error=True), FakeRepository(html="<p>x</p>")])
def test_import_reports_repository_failures(admin: TestClient, content, fake):
    admin.app.dependency_overrides[get_repository_client] = lambda: fake

    response = admin.post("/api/admin/documents", json={"source_url": ARTICLE_URL})

    assert response.status_code == 502


# ---- Edit ----


def test_patch_edits_metadata(admin: TestClient, content):
    office = content.office("Office of Testing")
    first, second = content.topic("first"), content.topic("second")
    tag_a, tag_b = content.tag("A"), content.tag("B")
    document = content.document("Doc", status=DocumentStatus.DRAFT)

    response = admin.patch(
        f"/api/admin/documents/{document.id}",
        json={
            "doc_type": "sop",
            "office_id": office.id,
            "topic_ids": [second.id, first.id, second.id],
            "tag_ids": [tag_b.id, tag_a.id],
            "is_authoritative": True,
        },
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["doc_type"] == "sop"
    assert body["office"]["id"] == office.id
    assert sorted(t["id"] for t in body["topics"]) == sorted([first.id, second.id])
    assert [t["name"] for t in body["tags"]] == ["A", "B"]
    assert body["is_authoritative"] is True
    assert body["updated_by"]["onyen"] == "admin-tester"


def test_patch_leaves_omitted_fields_and_can_clear_a_drafts_office(admin: TestClient, ready):
    response = admin.patch(f"/api/admin/documents/{ready.id}", json={"office_id": None})

    assert response.status_code == 200
    assert response.json()["office"] is None
    assert response.json()["topics"] != []


@pytest.mark.parametrize(
    "patch",
    [
        {"doc_type": None},
        {"topic_ids": None},
        {"tag_ids": None},
        {"is_authoritative": None},
        {"doc_type": "memo"},
        {"office_id": 999999999},
        {"topic_ids": [999999999]},
        {"tag_ids": [999999999]},
        {"tag_ids": [1, 2, 3, 4, 5, 6]},
    ],
)
def test_patch_rejects_invalid_values(admin: TestClient, ready, patch):
    assert admin.patch(f"/api/admin/documents/{ready.id}", json=patch).status_code == 422


@pytest.mark.parametrize("patch", [{"office_id": None}, {"topic_ids": []}])
def test_a_published_document_keeps_its_office_and_a_topic(admin: TestClient, ready, patch):
    admin.post(f"/api/admin/documents/{ready.id}/publish")

    assert admin.patch(f"/api/admin/documents/{ready.id}", json=patch).status_code == 422


def test_patch_unknown_document(admin: TestClient, content):
    assert admin.patch("/api/admin/documents/999999999", json={}).status_code == 404


# ---- Lifecycle ----


def test_lifecycle_publish_archive_restore(admin: TestClient, ready):
    def act(action: str):
        return admin.post(f"/api/admin/documents/{ready.id}/{action}")

    assert act("restore").status_code == 409  # a draft isn't archived

    published = act("publish")
    assert published.status_code == 200 and published.json()["status"] == "active"
    assert act("publish").status_code == 409
    assert admin.get(f"/api/documents/{ready.id}").status_code == 200

    archived = act("archive")
    assert archived.status_code == 200 and archived.json()["status"] == "archived"
    assert act("archive").status_code == 409
    assert act("publish").status_code == 409
    assert admin.get(f"/api/documents/{ready.id}").status_code == 404  # hidden from researchers

    restored = act("restore")
    assert restored.status_code == 200 and restored.json()["status"] == "draft"


def test_publish_needs_an_office_and_a_topic(admin: TestClient, content):
    document = content.document("Bare", status=DocumentStatus.DRAFT)

    response = admin.post(f"/api/admin/documents/{document.id}/publish")

    assert response.status_code == 409
    assert response.json()["detail"] == "Add an office and a topic before publishing"


# ---- Permanent delete ----


def test_delete_needs_confirmation_and_an_archived_document(admin: TestClient, ready):
    path = f"/api/admin/documents/{ready.id}"

    assert admin.delete(path).status_code == 422
    assert admin.delete(f"{path}?confirm=false").status_code == 422
    assert admin.delete(f"{path}?confirm=true").status_code == 409
    assert admin.delete("/api/admin/documents/999999999?confirm=true").status_code == 404


def test_delete_removes_an_archived_document(admin: TestClient, content, db_session: Session):
    tag, topic = content.tag("A"), content.topic("testing")
    document = content.document("Gone", topics=[topic], tags=[tag], status=DocumentStatus.ARCHIVED)
    older = content.document("Older", replaced_by_id=document.id)

    response = admin.delete(f"/api/admin/documents/{document.id}?confirm=true")

    assert response.status_code == 204
    assert db_session.get(Document, document.id) is None
    db_session.refresh(older)
    assert older.replaced_by_id is None
    assert db_session.scalars(select(Document.title)).all() == ["Older"]
