# Deployment

**Status:** Current as of 2026-10-29. The client's team handles Carolina CloudApps (OKD)
hosting; we handle UNC SSO integration.

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

## Who handles what (decided 2026-10-27)

- **Hosting on Carolina CloudApps (OKD / Kubernetes) is handled by the client's team.** At the
  2026-10-27 client meeting, UNC Research decided their team will set up and run the Kubernetes
  deployment. We don't need OKD access ourselves.
- **Our side:** keep the images OpenShift-compatible (rules above), keep every setting
  configurable by environment variable, and document what the deployment needs (images, env vars,
  migrations, database with pgvector). That documentation feeds the client handoff plan.
- **UNC SSO is still ours to integrate.** It's now our only access dependency.

## Access requests

- **OKD:** Andy and Anton emailed ITS about Kubernetes hosting on 2026-10-21. This is now the
  client team's responsibility, so the questions below are theirs to settle. We need the answers
  only where they affect our code (database, outbound AI access, hostname for SSO):
  - Is managed Postgres with pgvector available, or do we run our own pgvector pod with a
    persistent volume?
  - Is outbound access to LLM and embedding APIs allowed?
  - How do images get in (pull from GHCR, or an internal build or registry)?
  - What will the route hostname be?
  - How are secrets handled?
- **UNC SSO.** Requested from David Cowig (Jerry, 2026-10-12) and from ITS (Andy and Anton,
  2026-10-21). A reply has come back on the auth request; record its details in
  [auth.md](auth.md). Service provider registration usually needs the app's final hostname, which
  now comes from the client's team.

Record the answers here and in [decisions.md](decisions.md) when they come in.
