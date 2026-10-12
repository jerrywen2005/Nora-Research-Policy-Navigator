import re
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, StringConstraints

ONYEN_PATTERN = re.compile(r"[a-z0-9._-]{1,64}")


def _check_onyen(value: str) -> str:
    if not ONYEN_PATTERN.fullmatch(value):
        raise ValueError("Onyen may only contain letters, digits, '.', '_' and '-' (max 64)")
    return value


# Onyens are short alphanumeric IDs. Trimmed and lowercased first, then checked.
Onyen = Annotated[
    str,
    StringConstraints(strip_whitespace=True, to_lower=True),
    AfterValidator(_check_onyen),
]


class UserOut(BaseModel):
    """`User` in docs/api.md."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    onyen: str
    display_name: str | None
    email: str | None
    role: Literal["researcher", "admin"]


class MockLoginRequest(BaseModel):
    onyen: Onyen
