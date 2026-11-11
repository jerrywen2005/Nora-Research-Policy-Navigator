from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models import Document, DocumentStatus, Outcome, Question, SavedItem, User
from tests.conftest import login
from tests.questions import add_question

SAVED_ITEM_FIELDS = {"id", "created_at", "kind", "document", "question"}


@pytest.fixture
def me(client: TestClient, db_session: Session) -> User:
    """The signed-in researcher."""
    return db_session.get(User, login(client, "saver1")["id"])


@pytest.fixture
def policy(content):
    office = content.office("Office of Human Research Ethics")
    topic = content.topic("human-subjects-research")
    return content.document(
        "Use of Existing Data", topics=[topic], office=office, citation="OHRE SOP 1301"
    )


def saved_ids(db_session: Session, user_id: int) -> list[int]:
    return list(db_session.scalars(select(SavedItem.id).where(SavedItem.user_id == user_id)))


# ---- Sign-in ----


def test_requires_login(client: TestClient):
    assert client.get("/api/saved").status_code == 401
    assert client.post("/api/saved", json={"document_id": 1}).status_code == 401
    assert client.delete("/api/saved/1").status_code == 401


# ---- Saving ----


def test_save_a_document(client: TestClient, me, policy, db_session):
    response = client.post("/api/saved", json={"document_id": policy.id})

    assert response.status_code == 201, response.text
    body = response.json()
    assert set(body) == SAVED_ITEM_FIELDS
    assert body["kind"] == "document"
    assert body["question"] is None
    document = body["document"]
    assert document["id"] == policy.id
    assert document["title"] == "Use of Existing Data"
    assert document["citation"] == "OHRE SOP 1301"
    assert document["office"]["name"] == "Office of Human Research Ethics"
    assert [t["slug"] for t in document["topics"]] == ["human-subjects-research"]
    assert "content_text" not in document
    assert saved_ids(db_session, me.id) == [body["id"]]


def test_save_a_question(client: TestClient, me, db_session):
    question = add_question(db_session, me.id, text="Can I reuse a dataset?")

    response = client.post("/api/saved", json={"question_id": question.id})

    assert response.status_code == 201, response.text
    body = response.json()
    assert set(body) == SAVED_ITEM_FIELDS
    assert body["kind"] == "question"
    assert body["document"] is None
    assert set(body["question"]) == {"id", "question_text", "outcome", "answer_text", "created_at"}
    assert body["question"]["id"] == question.id
    assert body["question"]["question_text"] == "Can I reuse a dataset?"
    assert body["question"]["outcome"] == "answered"
    assert body["question"]["answer_text"] == "Usually yes. [1]"


def test_question_without_an_answer(client: TestClient, me, db_session):
    question = add_question(db_session, me.id, outcome=Outcome.REFERRED, answer_text=None)

    body = client.post("/api/saved", json={"question_id": question.id}).json()

    assert body["question"]["outcome"] == "referred"
    assert body["question"]["answer_text"] is None


def test_errored_question_is_shown_as_no_answer(client: TestClient, me, db_session):
    question = add_question(db_session, me.id, outcome=Outcome.ERROR)

    saved = client.post("/api/saved", json={"question_id": question.id}).json()
    [listed] = client.get("/api/saved").json()

    assert saved["question"]["outcome"] == "no_answer"
    assert listed["question"]["outcome"] == "no_answer"


@pytest.mark.parametrize("target", ["document", "question"])
def test_saving_twice_returns_the_existing_item(client: TestClient, me, policy, db_session, target):
    target_id = policy.id if target == "document" else add_question(db_session, me.id).id
    first = client.post("/api/saved", json={f"{target}_id": target_id})

    second = client.post("/api/saved", json={f"{target}_id": target_id})

    assert first.status_code == 201
    assert second.status_code == 200
    assert second.json() == first.json()
    assert saved_ids(db_session, me.id) == [first.json()["id"]]


@pytest.mark.parametrize(
    "body",
    [{}, {"document_id": None, "question_id": None}, {"document_id": 1, "question_id": 1}],
    ids=["empty", "both-null", "both-set"],
)
def test_exactly_one_id_is_required(client: TestClient, me, body):
    assert client.post("/api/saved", json=body).status_code == 422


def test_unknown_document_is_404(client: TestClient, me, policy):
    response = client.post("/api/saved", json={"document_id": policy.id + 10_000})

    assert response.status_code == 404
    assert response.json() == {"detail": "Document not found"}


@pytest.mark.parametrize("status", [DocumentStatus.ARCHIVED, DocumentStatus.DRAFT])
def test_document_that_isnt_active_is_404(client: TestClient, me, content, status):
    document = content.document("Old Policy", status=status)

    response = client.post("/api/saved", json={"document_id": document.id})

    assert response.status_code == 404
    assert response.json() == {"detail": "Document not found"}


def test_unknown_question_is_404(client: TestClient, me, db_session):
    question = add_question(db_session, me.id)

    response = client.post("/api/saved", json={"question_id": question.id + 10_000})

    assert response.status_code == 404
    assert response.json() == {"detail": "Question not found"}


def test_someone_elses_question_is_404(client: TestClient, me, make_user, db_session):
    other = add_question(db_session, make_user("other1").id)

    response = client.post("/api/saved", json={"question_id": other.id})

    # Indistinguishable from a question that doesn't exist.
    assert response.status_code == 404
    assert response.json() == {"detail": "Question not found"}
    assert saved_ids(db_session, me.id) == []


# ---- Listing ----


def test_list_is_empty_at_first(client: TestClient, me):
    response = client.get("/api/saved")

    assert response.status_code == 200
    assert response.json() == []


def test_list_is_newest_first_and_only_mine(
    client: TestClient, me, policy, content, make_user, db_session
):
    other_user = make_user("other1")
    question = add_question(db_session, me.id)
    second_policy = content.document("Data Security Standard")
    now = datetime.now(UTC)
    # Inserted oldest-last, so the order can't come from the ids.
    db_session.add_all(
        [
            SavedItem(user_id=me.id, document_id=policy.id, created_at=now),
            SavedItem(user_id=me.id, question_id=question.id, created_at=now - timedelta(days=1)),
            SavedItem(
                user_id=me.id, document_id=second_policy.id, created_at=now - timedelta(days=2)
            ),
            SavedItem(user_id=other_user.id, document_id=policy.id, created_at=now),
        ]
    )
    db_session.flush()

    body = client.get("/api/saved").json()

    assert [(item["kind"], (item["document"] or item["question"])["id"]) for item in body] == [
        ("document", policy.id),
        ("question", question.id),
        ("document", second_policy.id),
    ]


def test_archived_document_stays_listed_and_can_be_removed(
    client: TestClient, me, policy, db_session
):
    item_id = client.post("/api/saved", json={"document_id": policy.id}).json()["id"]
    db_session.get(Document, policy.id).status = DocumentStatus.ARCHIVED
    db_session.flush()

    [listed] = client.get("/api/saved").json()

    assert listed["id"] == item_id
    assert listed["document"]["id"] == policy.id
    assert client.delete(f"/api/saved/{item_id}").status_code == 204
    assert client.get("/api/saved").json() == []


# ---- Removing ----


def test_remove_a_saved_item(client: TestClient, me, policy, db_session):
    item_id = client.post("/api/saved", json={"document_id": policy.id}).json()["id"]

    response = client.delete(f"/api/saved/{item_id}")

    assert response.status_code == 204
    assert response.content == b""
    assert saved_ids(db_session, me.id) == []


def test_remove_unknown_item_is_404(client: TestClient, me):
    response = client.delete("/api/saved/999999999")

    assert response.status_code == 404
    assert response.json() == {"detail": "Saved item not found"}


def test_cannot_remove_someone_elses_item(client: TestClient, me, policy, make_user, db_session):
    other_user = make_user("other1")
    other_item = SavedItem(user_id=other_user.id, document_id=policy.id)
    db_session.add(other_item)
    db_session.flush()

    response = client.delete(f"/api/saved/{other_item.id}")

    assert response.status_code == 404
    assert response.json() == {"detail": "Saved item not found"}
    assert saved_ids(db_session, other_user.id) == [other_item.id]


# ---- Cascades ----


def test_deleting_a_document_deletes_saved_items(client: TestClient, me, content, db_session):
    document = content.document("Short-lived Policy")
    client.post("/api/saved", json={"document_id": document.id})
    db_session.expunge_all()

    db_session.execute(delete(Document).where(Document.id == document.id))

    assert saved_ids(db_session, me.id) == []


def test_deleting_a_question_deletes_saved_items(client: TestClient, me, db_session):
    question_id = add_question(db_session, me.id).id
    client.post("/api/saved", json={"question_id": question_id})
    db_session.expunge_all()

    db_session.execute(delete(Question).where(Question.id == question_id))

    assert saved_ids(db_session, me.id) == []


def test_deleting_a_user_deletes_their_saved_items(client: TestClient, me, policy, db_session):
    client.post("/api/saved", json={"document_id": policy.id})
    user_id = me.id
    db_session.expunge_all()

    db_session.execute(delete(User).where(User.id == user_id))

    assert saved_ids(db_session, user_id) == []
