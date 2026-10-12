from app.db import SessionLocal
from app.seed import run

with SessionLocal() as session:
    run(session)
print("Seed data loaded.")
