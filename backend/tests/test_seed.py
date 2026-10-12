from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import User
from app.seed import run
from app.seed.users import SEED_USERS


def test_seed_creates_users_and_is_idempotent(db_session: Session):
    run(db_session)
    run(db_session)

    users = {u.onyen: u for u in db_session.scalars(select(User))}
    for data in SEED_USERS:
        assert users[data["onyen"]].role == data["role"]
    assert users["admin1"].role == "admin"
    assert users["researcher1"].role == "researcher"
