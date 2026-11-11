from datetime import datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models import Feedback, Outcome, Question, User
from tests.conftest import login


@pytest.fixture
def make_question(db_session: Session):
    """Factory for logged questions, as POST /api/ask would write them."""

    def make(user_id: int | None, text: str = "Do I need IRB approval?") -> Question:
        question = Question(
            user_id=user_id,
            question_text=text,
            outcome=Outcome.ANSWERED,
            confidence=0.8,
            answer_text="Usually yes. [1]",
            prompt_version="test",
            latency_ms=10,
        )
        db_session.add(question)
        db_session.flush()
        return question

    return make


@pytest.fixture
def asker(client: TestClient, make_question):
    """A signed-in researcher and one question they asked."""
    user = login(client, "asker1")
    return make_question(user["id"])


def url(question_id: int) -> str:
    return f"/api/questions/{question_id}/feedback"


def stored(db_session: Session, question_id: int) -> list[Feedback]:
    return list(db_session.scalars(select(Feedback).where(Feedback.question_id == question_id)))


def test_requires_login(client: TestClient, make_user, make_question):
    question = make_question(make_user("someone").id)
    assert client.put(url(question.id), json={"helpful": True}).status_code == 401
    assert client.delete(url(question.id)).status_code == 401


def test_rate_an_answer(client: TestClient, asker, db_session):
    response = client.put(url(asker.id), json={"helpful": True, "comment": "Clear, thanks."})

    assert response.status_code == 200, response.text
    body = response.json()
    assert set(body) == {"question_id", "helpful", "comment", "created_at", "updated_at"}
    assert body["question_id"] == asker.id
    assert body["helpful"] is True
    assert body["comment"] == "Clear, thanks."
    assert body["updated_at"] == body["created_at"]
    [feedback] = stored(db_session, asker.id)
    assert feedback.user_id == asker.user_id


def test_comment_is_optional(client: TestClient, asker):
    response = client.put(url(asker.id), json={"helpful": False})

    assert response.status_code == 200, response.text
    assert response.json()["comment"] is None


def test_rating_again_replaces_the_rating(client: TestClient, asker, db_session):
    first = client.put(url(asker.id), json={"helpful": True, "comment": "Great"}).json()

    response = client.put(url(asker.id), json={"helpful": False, "comment": None})

    assert response.status_code == 200, response.text
    second = response.json()
    assert second["helpful"] is False
    assert second["comment"] is None
    assert second["created_at"] == first["created_at"]
    assert datetime.fromisoformat(second["updated_at"]) > datetime.fromisoformat(
        first["updated_at"]
    )
    assert len(stored(db_session, asker.id)) == 1


@pytest.mark.parametrize("comment", ["", "   ", "\n\t"])
def test_blank_comment_is_stored_as_null(client: TestClient, asker, db_session, comment):
    response = client.put(url(asker.id), json={"helpful": True, "comment": comment})

    assert response.status_code == 200, response.text
    assert response.json()["comment"] is None
    [feedback] = stored(db_session, asker.id)
    assert feedback.comment is None


def test_comment_is_trimmed(client: TestClient, asker):
    response = client.put(url(asker.id), json={"helpful": True, "comment": "  Useful.  "})

    assert response.json()["comment"] == "Useful."


def test_comment_over_1000_characters_is_rejected(client: TestClient, asker, db_session):
    assert (
        client.put(url(asker.id), json={"helpful": True, "comment": "x" * 1000}).status_code == 200
    )

    response = client.put(url(asker.id), json={"helpful": True, "comment": "x" * 1001})

    assert response.status_code == 422
    [feedback] = stored(db_session, asker.id)
    assert len(feedback.comment) == 1000


def test_helpful_is_required(client: TestClient, asker):
    assert client.put(url(asker.id), json={"comment": "No rating"}).status_code == 422


def test_unknown_question_is_404(client: TestClient, asker):
    response = client.put(url(asker.id + 10_000), json={"helpful": True})

    assert response.status_code == 404
    assert response.json() == {"detail": "Question not found"}


def test_rating_someone_elses_question_is_404(client: TestClient, asker, make_question, make_user):
    other = make_question(make_user("other1").id)

    response = client.put(url(other.id), json={"helpful": True})

    # Indistinguishable from a question that doesn't exist.
    assert response.status_code == 404
    assert response.json() == {"detail": "Question not found"}


def test_anonymized_question_cannot_be_rated(client: TestClient, asker, make_question):
    anonymous = make_question(None)

    assert client.put(url(anonymous.id), json={"helpful": True}).status_code == 404


def test_delete_rating(client: TestClient, asker, db_session):
    client.put(url(asker.id), json={"helpful": True})

    response = client.delete(url(asker.id))

    assert response.status_code == 204
    assert response.content == b""
    assert stored(db_session, asker.id) == []


def test_delete_without_a_rating_is_404(client: TestClient, asker):
    response = client.delete(url(asker.id))

    assert response.status_code == 404
    assert response.json() == {"detail": "Feedback not found"}


def test_cannot_delete_someone_elses_rating(
    client: TestClient, asker, make_question, make_user, db_session
):
    other_user = make_user("other1")
    other_question = make_question(other_user.id)
    db_session.add(Feedback(question_id=other_question.id, user_id=other_user.id, helpful=True))
    db_session.flush()

    assert client.delete(url(other_question.id)).status_code == 404
    assert len(stored(db_session, other_question.id)) == 1


def test_deleting_a_question_deletes_its_feedback(client: TestClient, asker, db_session):
    client.put(url(asker.id), json={"helpful": True})
    question_id = asker.id
    db_session.expunge_all()

    db_session.execute(delete(Question).where(Question.id == question_id))

    assert stored(db_session, question_id) == []


def test_deleting_a_user_deletes_their_feedback(client: TestClient, asker, db_session):
    client.put(url(asker.id), json={"helpful": True})
    question_id, user_id = asker.id, asker.user_id
    db_session.expunge_all()

    db_session.execute(delete(User).where(User.id == user_id))

    assert stored(db_session, question_id) == []
