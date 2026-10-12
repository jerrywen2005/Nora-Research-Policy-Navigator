from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from app.api import auth, health
from app.config import Settings, get_settings

API_PREFIX = "/api"


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    app = FastAPI(
        title="UNC Research Policy Navigator API",
        docs_url=f"{API_PREFIX}/docs",
        openapi_url=f"{API_PREFIX}/openapi.json",
    )

    if settings.cors_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.cors_origins,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    # Signed, HTTP-only cookie holding the signed-in user's id.
    app.add_middleware(
        SessionMiddleware,
        secret_key=settings.session_secret,
        session_cookie="nora_session",
        max_age=settings.session_max_age_seconds,
        same_site="lax",
        https_only=settings.is_production,
    )

    # All routes live under /api so the frontend proxy can forward one prefix.
    app.include_router(health.router, prefix=API_PREFIX)
    app.include_router(auth.router, prefix=API_PREFIX)
    if settings.auth_provider == "mock":
        app.include_router(auth.mock_router, prefix=API_PREFIX)
    return app


app = create_app()
