from typing import Annotated

import pytest
from fastapi import Depends
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import require_role
from app.config import Settings
from app.models import Role, User
from tests.conftest import login


def test_me_requires_login(client: TestClient):
    response = client.get("/api/me")
    assert response.status_code == 401
    assert response.json() == {"detail": "Not signed in"}


def test_mock_login_creates_new_user_as_researcher(client: TestClient, db_session: Session):
    body = login(client, "  NewPerson ")

    assert body["onyen"] == "newperson"
    assert body["role"] == "researcher"
    user = db_session.scalars(select(User).where(User.onyen == "newperson")).one()
    assert user.last_login_at is not None


def test_mock_login_existing_user_keeps_role(client: TestClient, make_user):
    make_user("boss", role=Role.ADMIN)

    body = login(client, "boss")

    assert body["role"] == "admin"


def test_me_returns_signed_in_user(client: TestClient):
    user = login(client, "researcher9")

    response = client.get("/api/me")

    assert response.status_code == 200
    assert response.json() == user
    assert set(user) == {"id", "onyen", "display_name", "email", "role"}


@pytest.mark.parametrize("onyen", ["", "has space", "x" * 65, "semi;colon"])
def test_mock_login_rejects_invalid_onyen(client: TestClient, onyen: str):
    response = client.post("/api/auth/mock-login", json={"onyen": onyen})
    assert response.status_code == 422


def test_mock_login_rejects_disabled_user(client: TestClient, make_user):
    make_user("gone", is_active=False)

    response = client.post("/api/auth/mock-login", json={"onyen": "gone"})

    assert response.status_code == 403
    assert client.get("/api/me").status_code == 401


def test_disabled_user_session_stops_working(client: TestClient, db_session: Session, make_user):
    user = make_user("leaving")
    login(client, "leaving")
    user.is_active = False
    db_session.flush()

    assert client.get("/api/me").status_code == 401


def test_logout_clears_session(client: TestClient):
    login(client, "researcher9")

    response = client.post("/api/auth/logout")

    assert response.status_code == 204
    assert client.get("/api/me").status_code == 401


def test_require_role_allows_matching_role_and_rejects_others(client: TestClient, make_user):
    @client.app.get("/api/test-admin-only")
    def admin_only(user: Annotated[User, Depends(require_role(Role.ADMIN))]) -> dict:
        return {"onyen": user.onyen}

    make_user("admin9", role=Role.ADMIN)

    assert client.get("/api/test-admin-only").status_code == 401
    login(client, "researcher9")
    assert client.get("/api/test-admin-only").status_code == 403
    login(client, "admin9")
    response = client.get("/api/test-admin-only")
    assert response.status_code == 200
    assert response.json() == {"onyen": "admin9"}


def test_production_rejects_mock_auth():
    with pytest.raises(ValidationError, match="AUTH_PROVIDER=mock"):
        Settings(environment="production", session_secret="real-secret")


def test_production_requires_session_secret():
    with pytest.raises(ValidationError, match="SESSION_SECRET"):
        Settings(environment="production")
