import datetime

import pytest
from fastapi.testclient import TestClient

from app.models import DocType, DocumentStatus
from tests.conftest import login


@pytest.fixture
def signed_in(client: TestClient) -> TestClient:
    login(client, "researcher1")
    return client


def titles(response) -> list[str]:
    assert response.status_code == 200, response.text
    return [item["title"] for item in response.json()["items"]]


def test_documents_require_login(client: TestClient):
    assert client.get("/api/documents").status_code == 401
    assert client.get("/api/documents/1").status_code == 401


def test_list_matches_the_api_contract(signed_in: TestClient, content):
    office = content.office("Office of Testing", phone="919-000-0000")
    topic = content.topic("testing", sort_order=1)
    other = content.topic("other", sort_order=2)
    retired = content.topic("retired", is_active=False)
    document = content.document(
        "Testing Policy",
        topics=[other, topic, retired],
        doc_type=DocType.SOP,
        citation="TEST SOP 1",
        source_url="https://policies.test/1",
        summary="What to test.",
        content_text="Full text.",
        office=office,
        is_authoritative=True,
        last_reviewed_at=datetime.date(2026, 8, 1),
    )

    response = signed_in.get("/api/documents")

    assert response.status_code == 200
    assert response.json() == {
        "items": [
            {
                "id": document.id,
                "title": "Testing Policy",
                "doc_type": "sop",
                "citation": "TEST SOP 1",
                "source_url": "https://policies.test/1",
                "summary": "What to test.",
                "office": {
                    "id": office.id,
                    "name": "Office of Testing",
                    "email": None,
                    "phone": "919-000-0000",
                    "url": None,
                },
                # Display order; inactive topics are hidden.
                "topics": [
                    {"id": topic.id, "slug": "testing", "name": "Testing"},
                    {"id": other.id, "slug": "other", "name": "Other"},
                ],
                "is_authoritative": True,
                "last_reviewed_at": "2026-08-01",
            }
        ],
        "total": 1,
    }


def test_list_without_query_is_active_documents_by_title(signed_in: TestClient, content):
    content.document("Beta")
    content.document("Alpha")
    content.document("Draft", status=DocumentStatus.DRAFT)
    content.document("Archived", status=DocumentStatus.ARCHIVED)

    assert titles(signed_in.get("/api/documents")) == ["Alpha", "Beta"]
    # A blank query is the same as no query.
    assert titles(signed_in.get("/api/documents", params={"q": "   "})) == ["Alpha", "Beta"]


def test_filter_by_topic(signed_in: TestClient, content):
    irb = content.topic("irb")
    coi = content.topic("coi")
    retired = content.topic("retired", is_active=False)
    content.document("IRB Doc", topics=[irb])
    content.document("COI Doc", topics=[coi])
    content.document("Both", topics=[irb, coi])
    content.document("Retired Doc", topics=[retired])

    assert titles(signed_in.get("/api/documents", params={"topic": "irb"})) == ["Both", "IRB Doc"]
    assert titles(signed_in.get("/api/documents", params={"topic": "retired"})) == []
    assert titles(signed_in.get("/api/documents", params={"topic": "missing"})) == []


def test_keyword_search_ranks_title_above_summary_above_body(signed_in: TestClient, content):
    content.document("Unrelated", content_text="Nothing to see here.")
    content.document("Body", content_text="Researchers must obtain informed consent.")
    content.document("Summary", summary="Informed consent requirements.")
    content.document("Informed Consent", content_text="Rules.")

    response = signed_in.get("/api/documents", params={"q": "informed consent"})

    assert titles(response) == ["Informed Consent", "Summary", "Body"]
    assert response.json()["total"] == 3


def test_keyword_search_stems_words_and_combines_with_topic(signed_in: TestClient, content):
    irb = content.topic("irb")
    content.document("Exempt Studies", topics=[irb], content_text="Exemption categories.")
    content.document("Exempt Elsewhere", content_text="Exempt from review.")

    response = signed_in.get("/api/documents", params={"q": "exemptions", "topic": "irb"})

    assert titles(response) == ["Exempt Studies"]


def test_keyword_search_with_no_matches(signed_in: TestClient, content):
    content.document("Something")

    response = signed_in.get("/api/documents", params={"q": "zebra"})

    assert response.json() == {"items": [], "total": 0}


def test_limit_and_offset_page_through_results(signed_in: TestClient, content):
    for title in ["A", "B", "C", "D", "E"]:
        content.document(title)

    response = signed_in.get("/api/documents", params={"limit": 2, "offset": 2})

    assert titles(response) == ["C", "D"]
    assert response.json()["total"] == 5


@pytest.mark.parametrize("params", [{"limit": 0}, {"limit": 101}, {"offset": -1}, {"q": "x" * 501}])
def test_invalid_query_parameters_are_422(signed_in: TestClient, content, params):
    assert signed_in.get("/api/documents", params=params).status_code == 422


def test_get_document_includes_full_text(signed_in: TestClient, content):
    document = content.document("Full", content_text="All the words.", summary="Short.")

    response = signed_in.get(f"/api/documents/{document.id}")

    assert response.status_code == 200
    body = response.json()
    assert body["title"] == "Full"
    assert body["content_text"] == "All the words."
    assert body["office"] is None
    assert body["topics"] == []


def test_get_missing_or_inactive_document_is_404(signed_in: TestClient, content):
    draft = content.document("Draft", status=DocumentStatus.DRAFT)
    archived = content.document("Archived", status=DocumentStatus.ARCHIVED)

    for document_id in [draft.id, archived.id, 999_999_999]:
        response = signed_in.get(f"/api/documents/{document_id}")
        assert response.status_code == 404
        assert response.json() == {"detail": "Document not found"}
