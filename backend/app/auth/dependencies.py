from collections.abc import Callable
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.db import get_session
from app.models import Role, User

SESSION_USER_KEY = "user_id"


def get_current_user(request: Request, session: Annotated[Session, Depends(get_session)]) -> User:
    """The signed-in user, or 401. Reads the session set at login."""
    user_id = request.session.get(SESSION_USER_KEY)
    user = session.get(User, user_id) if user_id is not None else None
    if user is None or not user.is_active:
        request.session.clear()
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not signed in")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_role(role: Role) -> Callable[[User], User]:
    """Dependency factory: `Depends(require_role(Role.ADMIN))` returns 403 for other roles."""

    def check(user: CurrentUser) -> User:
        if user.role != role:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not allowed for your role")
        return user

    return check
