from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.auth import CurrentUser
from app.auth.dependencies import SESSION_USER_KEY
from app.auth.users import record_login
from app.db import get_session
from app.models import User
from app.schemas.user import MockLoginRequest, UserOut

router = APIRouter(tags=["auth"])

# Only mounted when AUTH_PROVIDER=mock (see app/main.py). Config refuses mock in production.
mock_router = APIRouter(tags=["auth"])


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser) -> User:
    return user


@router.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request) -> Response:
    request.session.clear()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@mock_router.post("/auth/mock-login", response_model=UserOut)
def mock_login(
    body: MockLoginRequest,
    request: Request,
    session: Annotated[Session, Depends(get_session)],
) -> User:
    """Sign in as any Onyen, no password. Stands in for UNC SSO until access is granted."""
    user = record_login(session, body.onyen)
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account is disabled")
    session.commit()
    request.session[SESSION_USER_KEY] = user.id
    return user
