from functools import lru_cache
from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Only for local development and tests. Production must set SESSION_SECRET.
DEV_SESSION_SECRET = "dev-only-insecure-session-secret"


class Settings(BaseSettings):
    """App settings, read from environment variables (and a local .env file in development)."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = "local"
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/policy_navigator"
    # Only needed when the frontend is served from a different origin than the API.
    # Locally the Vite proxy and in production the nginx proxy make them same-origin.
    cors_origins: list[str] = []

    # "mock" until UNC SSO access is granted; see docs/auth.md.
    auth_provider: Literal["mock"] = "mock"
    # Signs the session cookie. Anyone who knows it can forge a login.
    session_secret: str = DEV_SESSION_SECRET
    session_max_age_seconds: int = 8 * 60 * 60

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @model_validator(mode="after")
    def _check_production_safety(self) -> "Settings":
        if self.is_production:
            if self.session_secret == DEV_SESSION_SECRET:
                raise ValueError("SESSION_SECRET must be set in production")
            if self.auth_provider == "mock":
                raise ValueError("AUTH_PROVIDER=mock must not be used in production")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
