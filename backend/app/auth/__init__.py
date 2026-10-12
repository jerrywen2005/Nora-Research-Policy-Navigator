"""Authentication (who you are) and authorization (your role). See docs/auth.md.

Routes depend on `get_current_user` or `require_role` and never read the session cookie or
identity headers themselves, so the auth provider can be swapped without touching them.
"""

from app.auth.dependencies import CurrentUser, get_current_user, require_role

__all__ = ["CurrentUser", "get_current_user", "require_role"]
