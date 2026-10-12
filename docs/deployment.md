# Deployment

**Status:** Current as of 2026-10-11. Carolina CloudApps (OKD) access has been requested but not
granted.

## Environments

| Environment | Where | Data | Auth |
|---|---|---|---|
| Local | `docker compose up --build` | seed data | mock |
| CI | GitHub Actions, with a Postgres + pgvector service | test data | mock / fakes |
| Interim (optional) | a portable host such as Render, Railway or Fly | public docs and fake users only | mock |
| Production | Carolina CloudApps (OKD / OpenShift) | approved docs, real users | UNC SSO |

The same Docker images run everywhere. Everything that differs between environments comes from
env vars (`DATABASE_URL`, `ENVIRONMENT`, `AUTH_PROVIDER`, `SESSION_SECRET`, AI API keys).

Interim hosts must never receive real Onyens or real researcher questions until UNC confirms where
that data may be stored.

## Image requirements (OpenShift)

- Containers run as non-root with an arbitrary UID. Don't write outside `/tmp` or mounted
  volumes.
- Frontend production image: nginx-unprivileged on port 8080. It serves the static build and
  proxies `/api` to the backend.
- Backend: uvicorn. Run `alembic upgrade head` as a startup step or a one-off job before rollout.

## Access requests (pending)

- **OKD (ITS, CC Vinir).** Questions to resolve:
  - Is managed Postgres with pgvector available, or do we run our own pgvector pod with a
    persistent volume?
  - Is outbound access to LLM and embedding APIs allowed?
  - How do images get in (pull from GHCR, or an internal build or registry)?
  - What will the route hostname be?
  - How are secrets handled?
- **UNC SSO (David Cowig).** Service provider registration usually needs the app's final hostname,
  so it depends on OKD. See [auth.md](auth.md).

Record the answers here and in [decisions.md](decisions.md) when they come in.
