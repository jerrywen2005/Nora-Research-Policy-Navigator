import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models import DocumentStatus, Faq, FaqStatus, Role, faq_documents
from tests.conftest import login


@pytest.fixture
def faqs(db_session: Session, content):
    """A factory for FAQs, starting from an empty faqs table (your dev database may have some)."""
    db_session.execute(delete(faq_documents))
    db_session.execute(delete(Faq))

    def make(question: str, topic=None, documents=(), **fields) -> Faq:
        fields.setdefault("answer", f"Answer to {question}")
        fields.setdefault("status", FaqStatus.PUBLISHED)
        faq = Faq(question=question, topic=topic, documents=list(documents), **fields)
        db_session.add(faq)
        db_session.flush()
        db_session.expire(faq)
        return faq

    return make


@pytest.fixture
def admin(client: TestClient, make_user) -> TestClient:
    make_user("admin-tester", role=Role.ADMIN)
    login(client, "admin-tester")
    return client


@pytest.fixture
def researcher(client: TestClient) -> TestClient:
    login(client, "researcher1")
    return client


# ---- Researcher list ----


def test_faqs_need_sign_in(client: TestClient):
    assert client.get("/api/faqs").status_code == 401


def test_researchers_see_only_published_faqs_in_order(researcher: TestClient, content, faqs):
    topic = content.topic("irb")
    faqs("Zebra question?", topic, sort_order=0)
    faqs("Apple question?", topic, sort_order=0)
    faqs("First by sort order?", topic, sort_order=-1)
    faqs("A draft?", topic, status=FaqStatus.DRAFT)
    faqs("An archived one?", topic, status=FaqStatus.ARCHIVED)

    body = researcher.get("/api/faqs").json()

    assert [f["question"] for f in body] == [
        "First by sort order?",
        "Apple question?",
        "Zebra question?",
    ]
    assert body[0]["topic"] == {"id": topic.id, "slug": "irb", "name": "Irb"}
    assert body[0]["answer"] == "Answer to First by sort order?"
    assert set(body[0]) == {"id", "question", "answer", "topic", "sources", "updated_at"}


def test_topic_filter(researcher: TestClient, content, faqs):
    irb = content.topic("irb")
    faqs("IRB question?", irb)
    faqs("Export question?", content.topic("export"))

    assert [f["question"] for f in researcher.get("/api/faqs?topic=irb").json()] == [
        "IRB question?"
    ]
    assert researcher.get("/api/faqs?topic=unknown").json() == []


def test_researchers_see_only_active_sources(researcher: TestClient, content, faqs):
    active = content.document("Active Policy", citation="POL 1")
    draft = content.document("Draft Policy", status=DocumentStatus.DRAFT)
    archived = content.document("Archived Policy", status=DocumentStatus.ARCHIVED)
    faqs("Question?", content.topic("irb"), documents=[active, draft, archived])

    [faq] = researcher.get("/api/faqs").json()

    assert faq["sources"] == [
        {"id": active.id, "title": "Active Policy", "doc_type": "policy", "citation": "POL 1"}
    ]


# ---- Admin access ----


def test_admin_faqs_need_the_admin_role(client: TestClient, faqs):
    faq = faqs("Question?")
    paths = [
        ("get", "/api/admin/faqs"),
        ("get", f"/api/admin/faqs/{faq.id}"),
        ("post", "/api/admin/faqs"),
        ("patch", f"/api/admin/faqs/{faq.id}"),
        ("post", f"/api/admin/faqs/{faq.id}/publish"),
        ("post", f"/api/admin/faqs/{faq.id}/archive"),
        ("post", f"/api/admin/faqs/{faq.id}/restore"),
        ("delete", f"/api/admin/faqs/{faq.id}?confirm=true"),
    ]
    for method, path in paths:
        assert client.request(method, path).status_code == 401, path
    login(client, "researcher1")
    for method, path in paths:
        assert client.request(method, path).status_code == 403, path


# ---- Admin list and detail ----


def test_admin_list_shows_every_status_and_filters(admin: TestClient, content, faqs):
    irb = content.topic("irb")
    faqs("Published?", irb)
    faqs("Draft?", irb, status=FaqStatus.DRAFT)
    faqs("Archived?", content.topic("export"), status=FaqStatus.ARCHIVED)

    def questions(query: str = "") -> list[str]:
        return [f["question"] for f in admin.get(f"/api/admin/faqs{query}").json()]

    assert questions() == ["Archived?", "Draft?", "Published?"]
    assert questions("?status=draft") == ["Draft?"]
    assert questions("?topic=irb") == ["Draft?", "Published?"]
    assert admin.get("/api/admin/faqs?status=active").status_code == 422


def test_admin_detail_shows_every_source(admin: TestClient, content, faqs):
    draft = content.document("Draft Policy", status=DocumentStatus.DRAFT)
    faq = faqs("Question?", documents=[draft], status=FaqStatus.DRAFT, sort_order=3)

    body = admin.get(f"/api/admin/faqs/{faq.id}").json()

    assert [s["title"] for s in body["sources"]] == ["Draft Policy"]
    assert body["status"] == "draft"
    assert body["sort_order"] == 3
    assert body["topic"] is None
    assert body["updated_by"] is None
    assert admin.get("/api/admin/faqs/999999").status_code == 404


# ---- Create and edit ----


def test_create_makes_a_draft(admin: TestClient, content, faqs):
    topic = content.topic("irb")
    document = content.document("Policy")

    response = admin.post(
        "/api/admin/faqs",
        json={
            "question": "  Do I need IRB approval?  ",
            "answer": "Usually.",
            "topic_id": topic.id,
            "document_ids": [document.id, document.id],
            "sort_order": 2,
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["question"] == "Do I need IRB approval?"
    assert body["status"] == "draft"
    assert body["topic"]["slug"] == "irb"
    assert [s["id"] for s in body["sources"]] == [document.id]
    assert body["updated_by"]["onyen"] == "admin-tester"


def test_create_needs_only_question_and_answer(admin: TestClient, faqs):
    response = admin.post("/api/admin/faqs", json={"question": "Q?", "answer": "A."})

    assert response.status_code == 201
    assert response.json()["topic"] is None
    assert response.json()["sources"] == []


@pytest.mark.parametrize(
    "body",
    [
        {"question": "   ", "answer": "A."},
        {"question": "Q?", "answer": ""},
        {"question": "Q" * 501, "answer": "A."},
        {"question": "Q?", "answer": "A.", "topic_id": 999999},
        {"question": "Q?", "answer": "A.", "document_ids": [999999]},
    ],
)
def test_create_rejects_invalid_input(admin: TestClient, faqs, body):
    assert admin.post("/api/admin/faqs", json=body).status_code == 422


def test_patch_edits_only_the_given_fields(admin: TestClient, content, faqs):
    old_topic, new_topic = content.topic("old"), content.topic("new")
    old_doc, new_doc = content.document("Old"), content.document("New")
    faq = faqs("Question?", old_topic, documents=[old_doc], status=FaqStatus.DRAFT)

    body = admin.patch(
        f"/api/admin/faqs/{faq.id}",
        json={"answer": "New answer.", "topic_id": new_topic.id, "document_ids": [new_doc.id]},
    ).json()

    assert body["question"] == "Question?"
    assert body["answer"] == "New answer."
    assert body["topic"]["slug"] == "new"
    assert [s["title"] for s in body["sources"]] == ["New"]

    body = admin.patch(
        f"/api/admin/faqs/{faq.id}",
        json={"question": "Renamed?", "sort_order": 5, "topic_id": None, "document_ids": []},
    ).json()

    assert body["question"] == "Renamed?"
    assert body["sort_order"] == 5
    assert body["topic"] is None
    assert body["sources"] == []


@pytest.mark.parametrize(
    "body",
    [
        {"question": None},
        {"answer": None},
        {"document_ids": None},
        {"sort_order": None},
        {"answer": "  "},
        {"topic_id": 999999},
        {"document_ids": [999999]},
    ],
)
def test_patch_rejects_invalid_input(admin: TestClient, faqs, body):
    faq = faqs("Question?", status=FaqStatus.DRAFT)
    assert admin.patch(f"/api/admin/faqs/{faq.id}", json=body).status_code == 422


def test_a_published_faq_keeps_its_topic(admin: TestClient, content, faqs):
    faq = faqs("Question?", content.topic("irb"))

    response = admin.patch(f"/api/admin/faqs/{faq.id}", json={"topic_id": None})

    assert response.status_code == 422
    assert "topic" in response.json()["detail"]


def test_patch_unknown_faq(admin: TestClient, faqs):
    assert admin.patch("/api/admin/faqs/999999", json={}).status_code == 404


# ---- Lifecycle ----


def test_publish_needs_a_draft_with_a_topic(admin: TestClient, content, faqs):
    no_topic = faqs("No topic?", status=FaqStatus.DRAFT)
    response = admin.post(f"/api/admin/faqs/{no_topic.id}/publish")
    assert response.status_code == 409
    assert "topic" in response.json()["detail"]

    ready = faqs("Ready?", content.topic("irb"), status=FaqStatus.DRAFT)
    response = admin.post(f"/api/admin/faqs/{ready.id}/publish")
    assert response.status_code == 200
    assert response.json()["status"] == "published"

    assert admin.post(f"/api/admin/faqs/{ready.id}/publish").status_code == 409


def test_archive_and_restore(admin: TestClient, content, faqs):
    faq = faqs("Question?", content.topic("irb"))

    assert admin.post(f"/api/admin/faqs/{faq.id}/restore").status_code == 409
    response = admin.post(f"/api/admin/faqs/{faq.id}/archive")
    assert response.json()["status"] == "archived"
    assert admin.post(f"/api/admin/faqs/{faq.id}/archive").status_code == 409

    response = admin.post(f"/api/admin/faqs/{faq.id}/restore")
    assert response.status_code == 200
    assert response.json()["status"] == "draft"


def test_delete_needs_confirmation_and_an_archived_faq(
    admin: TestClient, db_session: Session, content, faqs
):
    document = content.document("Policy")
    faq = faqs("Question?", documents=[document], status=FaqStatus.ARCHIVED)
    published = faqs("Published?")

    assert admin.delete(f"/api/admin/faqs/{faq.id}").status_code == 422
    assert admin.delete(f"/api/admin/faqs/{published.id}?confirm=true").status_code == 409
    assert admin.delete("/api/admin/faqs/999999?confirm=true").status_code == 404

    assert admin.delete(f"/api/admin/faqs/{faq.id}?confirm=true").status_code == 204
    assert db_session.get(Faq, faq.id) is None
    assert db_session.scalars(select(faq_documents.c.faq_id)).all() == []
    assert document.title == "Policy"  # the source document is kept
