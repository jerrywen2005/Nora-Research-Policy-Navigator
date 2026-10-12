from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Role, User

# Fake accounts for local development and demos. Never real Onyens.
SEED_USERS = [
    {
        "onyen": "researcher1",
        "display_name": "Test Researcher",
        "email": "researcher1@example.unc.edu",
        "role": Role.RESEARCHER,
    },
    {
        "onyen": "admin1",
        "display_name": "Test Admin",
        "email": "admin1@example.unc.edu",
        "role": Role.ADMIN,
    },
]


def seed_users(session: Session) -> None:
    """Create or update the seed users. Safe to run repeatedly. Does not commit."""
    for data in SEED_USERS:
        user = session.scalars(select(User).where(User.onyen == data["onyen"])).one_or_none()
        if user is None:
            user = User(onyen=data["onyen"])
            session.add(user)
        user.display_name = data["display_name"]
        user.email = data["email"]
        user.role = data["role"]
    session.flush()
