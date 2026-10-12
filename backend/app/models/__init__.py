"""ORM models. Import every model module here so Alembic autogenerate sees all tables."""

from app.models.user import Role, User

__all__ = ["Role", "User"]
