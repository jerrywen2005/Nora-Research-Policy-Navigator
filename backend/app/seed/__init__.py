"""Dummy data for local development and demos. Run with `python -m app.seed` from backend/.

Each area has its own module with an idempotent `seed_*` function; `run` calls them in order.
"""

from sqlalchemy.orm import Session

from app.seed.content import seed_content
from app.seed.users import seed_users


def run(session: Session) -> None:
    seed_users(session)
    seed_content(session)
    session.commit()
