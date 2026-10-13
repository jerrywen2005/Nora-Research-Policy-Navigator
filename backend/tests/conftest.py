"""Shared test fixtures.

Tests run against the real Postgres at DATABASE_URL (docker compose locally, a service in CI).
The schema is migrated once per run, and each test runs inside a transaction that is rolled back,
so tests never see each other's rows and never leave data in your dev database.
"""

from collections.abc import Iterator
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.config import Settings
from app.db import engine, get_session
from app.main import create_app
from app.models import (
    DocType,
    Document,
    DocumentStatus,
    Office,
    Role,
    Topic,
    User,
    document_topics,
)

ALEMBIC_INI = Path(__file__).resolve().parent.parent / "alembic.ini"


@pytest.fixture(scope="session", autouse=True)
def _migrated_database() -> None:
    command.upgrade(Config(str(ALEMBIC_INI)), "head")


@pytest.fixture
def db_session() -> Iterator[Session]:
    """A session whose commits only release savepoints; everything is rolled back afterwards."""
    connection = engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection, join_transaction_mode="create_savepoint")
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture
def client(db_session: Session) -> Iterator[TestClient]:
    """A test client whose requests use `db_session`."""
    app = create_app(Settings())
    app.dependency_overrides[get_session] = lambda: db_session
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def make_user(db_session: Session):
    """Factory for users: `make_user("someone", role=Role.ADMIN)`."""

    def make(onyen: str, role: Role = Role.RESEARCHER, is_active: bool = True) -> User:
        user = User(onyen=onyen, role=role, is_active=is_active)
        db_session.add(user)
        db_session.flush()
        return user

    return make


def login(client: TestClient, onyen: str) -> dict:
    """Sign the client in through the mock provider and return the user JSON."""
    response = client.post("/api/auth/mock-login", json={"onyen": onyen})
    assert response.status_code == 200, response.text
    return response.json()


@pytest.fixture
def content(db_session: Session):
    """Factories for offices, topics and documents, starting from empty content tables.

    Your dev database may already hold seed content; it is deleted inside this test's
    transaction, so results only contain what the test creates.
    """
    db_session.execute(delete(document_topics))
    db_session.execute(delete(Document))
    db_session.execute(delete(Topic))
    db_session.execute(delete(Office))

    class Factory:
        @staticmethod
        def office(name: str = "Test Office", **fields) -> Office:
            office = Office(name=name, **fields)
            db_session.add(office)
            db_session.flush()
            return office

        @staticmethod
        def topic(slug: str, **fields) -> Topic:
            fields.setdefault("name", slug.replace("-", " ").title())
            topic = Topic(slug=slug, **fields)
            db_session.add(topic)
            db_session.flush()
            return topic

        @staticmethod
        def document(title: str, topics: list[Topic] = (), **fields) -> Document:
            fields.setdefault("doc_type", DocType.POLICY)
            fields.setdefault("status", DocumentStatus.ACTIVE)
            document = Document(title=title, topics=list(topics), **fields)
            db_session.add(document)
            db_session.flush()
            # Reload relationships from the database on next access, as a real request would.
            db_session.expire(document)
            return document

    return Factory
