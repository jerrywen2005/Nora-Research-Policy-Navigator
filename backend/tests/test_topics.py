from fastapi.testclient import TestClient

from app.models import DocumentStatus
from tests.conftest import login


def test_topics_require_login(client: TestClient):
    assert client.get("/api/topics").status_code == 401
    assert client.get("/api/topics/anything").status_code == 401


def test_list_topics_in_display_order_with_active_document_counts(client: TestClient, content):
    second = content.topic("b-topic", sort_order=2)
    first = content.topic("z-topic", sort_order=1, description="Shown first.")
    content.topic("a-topic", sort_order=2)
    content.topic("hidden", is_active=False)
    content.document("Active", topics=[first, second])
    content.document("Also active", topics=[first])
    content.document("Draft", topics=[first], status=DocumentStatus.DRAFT)
    content.document("Archived", topics=[first], status=DocumentStatus.ARCHIVED)
    login(client, "researcher1")

    response = client.get("/api/topics")

    assert response.status_code == 200
    body = response.json()
    assert [t["slug"] for t in body] == ["z-topic", "a-topic", "b-topic"]
    assert body[0] == {
        "id": first.id,
        "slug": "z-topic",
        "name": "Z Topic",
        "description": "Shown first.",
        "document_count": 2,
    }
    assert [t["document_count"] for t in body] == [2, 0, 1]


def test_get_topic_includes_referral_office(client: TestClient, content):
    office = content.office("Office of Testing", email="test@example.edu", url="https://x.test/")
    topic = content.topic("testing", default_office_id=office.id)
    content.document("Doc", topics=[topic])
    login(client, "researcher1")

    response = client.get("/api/topics/testing")

    assert response.status_code == 200
    assert response.json() == {
        "id": topic.id,
        "slug": "testing",
        "name": "Testing",
        "description": "",
        "document_count": 1,
        "office": {
            "id": office.id,
            "name": "Office of Testing",
            "email": "test@example.edu",
            "phone": None,
            "url": "https://x.test/",
        },
    }


def test_get_topic_without_office(client: TestClient, content):
    content.topic("no-office")
    login(client, "researcher1")

    response = client.get("/api/topics/no-office")

    assert response.status_code == 200
    assert response.json()["office"] is None


def test_get_unknown_or_inactive_topic_is_404(client: TestClient, content):
    content.topic("retired", is_active=False)
    login(client, "researcher1")

    for slug in ["missing", "retired"]:
        response = client.get(f"/api/topics/{slug}")
        assert response.status_code == 404
        assert response.json() == {"detail": "Topic not found"}
