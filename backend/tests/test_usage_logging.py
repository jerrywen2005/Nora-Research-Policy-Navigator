import logging

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from app.analytics import logging as usage_logging
from app.models import EventType, UsageEvent, User
from tests.conftest import login


def events(db_session: Session) -> list[UsageEvent]:
    return list(db_session.scalars(select(UsageEvent).order_by(UsageEvent.id)))


@pytest.fixture
def researcher(client: TestClient, db_session: Session) -> User:
    """Signed in, with the login event already cleared out of the way."""
    user = db_session.get(User, login(client, "logger1")["id"])
    db_session.query(UsageEvent).delete()
    return user


# ---- Each instrumented endpoint writes the right event ----


def test_login_is_logged(client: TestClient, db_session):
    user = login(client, "logger1")

    [event] = events(db_session)
    assert (event.event_type, event.user_id) == (EventType.LOGIN, user["id"])
    assert (event.topic_id, event.document_id, event.query, event.result_count) == (None,) * 4
    assert event.created_at is not None


def test_topic_view_is_logged(client: TestClient, researcher, content, db_session):
    topic = content.topic("export-controls")

    assert client.get("/api/topics/export-controls").status_code == 200

    [event] = events(db_session)
    assert (event.event_type, event.user_id, event.topic_id) == (
        EventType.TOPIC_VIEW,
        researcher.id,
        topic.id,
    )


def test_unknown_topic_isnt_logged(client: TestClient, researcher, content, db_session):
    assert client.get("/api/topics/nope").status_code == 404
    assert events(db_session) == []


def test_document_view_is_logged(client: TestClient, researcher, content, db_session):
    document = content.document("Export Controls Policy")

    assert client.get(f"/api/documents/{document.id}").status_code == 200

    [event] = events(db_session)
    assert (event.event_type, event.user_id, event.document_id) == (
        EventType.DOCUMENT_VIEW,
        researcher.id,
        document.id,
    )


def test_search_is_logged_trimmed_and_lowercased(
    client: TestClient, researcher, content, db_session
):
    content.document("Export Controls Policy")
    content.document("Export Licenses for Travel")

    response = client.get("/api/documents", params={"q": "  EXPORT  ", "limit": 1})

    assert response.json()["total"] == 2
    [event] = events(db_session)
    assert (event.event_type, event.user_id) == (EventType.SEARCH, researcher.id)
    # The total match count, not the size of the page.
    assert (event.query, event.result_count) == ("export", 2)


def test_search_with_no_results_logs_zero(client: TestClient, researcher, content, db_session):
    client.get("/api/documents", params={"q": "nothing matches this"})

    [event] = events(db_session)
    assert (event.query, event.result_count) == ("nothing matches this", 0)


@pytest.mark.parametrize(
    "params", [{}, {"q": "   "}, {"topic": "x"}, {"q": "export", "offset": 20}]
)
def test_browsing_and_later_pages_arent_searches(
    client: TestClient, researcher, content, db_session, params
):
    assert client.get("/api/documents", params=params).status_code == 200
    assert events(db_session) == []


# ---- Logging never breaks the request ----


@pytest.fixture
def caplog(caplog, monkeypatch):
    """caplog for app.analytics.logging. The test run's Alembic upgrade (fileConfig in
    alembic/env.py) disables loggers that already exist, so switch this one back on."""
    monkeypatch.setattr(usage_logging.log, "disabled", False)
    return caplog


def test_failed_insert_keeps_the_callers_work(client: TestClient, db_session, monkeypatch, caplog):
    def broken_event(**fields):
        return UsageEvent(**{**fields, "event_type": "not_a_type"})  # violates the CHECK

    monkeypatch.setattr(usage_logging, "UsageEvent", broken_event)

    with caplog.at_level(logging.ERROR, logger="app.analytics.logging"):
        response = client.post("/api/auth/mock-login", json={"onyen": "newperson"})

    assert response.status_code == 200
    assert response.json()["onyen"] == "newperson"
    # The login itself (the new user) survived; only the event was undone.
    assert db_session.scalars(select(User).where(User.onyen == "newperson")).one()
    assert events(db_session) == []
    assert "Couldn't log a login event" in caplog.text
    assert client.get("/api/me").status_code == 200


def test_failed_commit_still_returns_the_page(
    client: TestClient, researcher, content, db_session, monkeypatch, caplog
):
    document = content.document("Export Controls Policy")

    def fail():
        raise OperationalError("COMMIT", {}, Exception("database went away"))

    monkeypatch.setattr(db_session, "commit", fail)
    with caplog.at_level(logging.ERROR, logger="app.analytics.logging"):
        response = client.get(f"/api/documents/{document.id}")

    assert response.status_code == 200
    assert response.json()["title"] == "Export Controls Policy"
    assert "Couldn't commit a document_view event" in caplog.text


def test_log_event_without_a_user(db_session):
    usage_logging.log_event(db_session, None, EventType.SEARCH, query=" Mixed Case ")

    [event] = events(db_session)
    assert (event.user_id, event.query) == (None, "mixed case")
