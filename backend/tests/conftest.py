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
from sqlalchemy.orm import Session

from app.config import Settings
from app.db import engine, get_session
from app.main import create_app
from app.models import Role, User

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
