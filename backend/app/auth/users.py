from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import User


def record_login(session: Session, onyen: str) -> User:
    """Find the user by Onyen (creating a researcher if new) and stamp the login time.

    Called by every auth provider after it has established who the person is. Does not commit.
    """
    user = session.scalars(select(User).where(User.onyen == onyen)).one_or_none()
    if user is None:
        user = User(onyen=onyen)
        session.add(user)
    user.last_login_at = datetime.now(UTC)
    session.flush()
    return user
