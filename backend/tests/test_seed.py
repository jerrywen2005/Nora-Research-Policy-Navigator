from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models import User
from app.seed import run
from app.seed.users import SEED_USERS


def test_seed_creates_users_and_is_idempotent(db_session: Session):
    # Your dev database may already hold the seed users (docker compose seeds on startup).
    # Remove them inside this test's transaction so both the create and update paths run.
    seed_onyens = [data["onyen"] for data in SEED_USERS]
    db_session.execute(delete(User).where(User.onyen.in_(seed_onyens)))

    run(db_session)  # creates
    run(db_session)  # updates in place, no duplicates

    users = db_session.scalars(select(User).where(User.onyen.in_(seed_onyens))).all()
    assert {u.onyen: u.role for u in users} == {"researcher1": "researcher", "admin1": "admin"}
