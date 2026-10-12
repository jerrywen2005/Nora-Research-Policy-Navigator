# CLAUDE.md

Shared instructions for Claude Code on this project. Every team member's Claude reads this file.
It holds the general rules. Details live in [docs/](docs/README.md), and setup is in
[README.md](README.md).

## Keep the docs current (required)

CLAUDE.md and `docs/` are the project's only memory. A fresh session knows nothing that isn't
written down, so updating the docs is part of every task, not an extra step:

- **When a decision is made or new information arrives** (the user mentions a client or coach
  meeting outcome, an answered open question, a changed requirement or deadline, a new
  convention), update the docs in the same session without being asked:
  - add a dated entry to [docs/decisions.md](docs/decisions.md), and move answered open questions
    into its log;
  - update the detailed doc it affects (schema → `database.md`, auth → `auth.md`, and so on);
  - update this file only if a general rule or convention changed.
- **When code changes something documented** (schema, endpoints, auth flow, commands), update the
  doc in the same change. Tick off finished items in [docs/roadmap.md](docs/roadmap.md).
- Keep this file short and general. Put detail in `docs/` and link to it.
- If the docs and the code disagree, say so and ask which is intended. Don't silently pick one.
- When finishing a task, tell the user which docs you updated.

**Starting a task:** read [docs/roadmap.md](docs/roadmap.md) for current status, plus the
`docs/` file for the area you're touching.

## Project

**Nora, the Research Policy Navigator** (COMP 523) for UNC Research (Office of the Vice Chancellor
for Research). Clients: Jeanne Lovmo and Quinton Johnson. Requirements, content standards and
testing come from the client's **Research Policy Navigator Link** working group. We build what they
specify; anything unclear goes on the open-questions list instead of being decided by us. See
[docs/product.md](docs/product.md).

Researchers **browse topics**, **search** (keyword), or **ask a question** (an answer grounded in
the Research Policy Repository, with citations). Admins manage content and view analytics. There
are two roles: `researcher` and `admin`.

Product rules that affect code:
- Every AI answer cites its sources. Nora is not an open-ended chatbot.
- If the sources can't support a confident answer, say so and refer the user to the responsible
  office. Never guess, and never present an interpretation as policy.
- Answers are informational guidance, not compliance determinations, and the UI says so.
- Browse, Search and Ask are equally prominent; none is the "main" one.
- Only curated public or client-approved documents. No confidential records and no enterprise
  integrations (IRB, COI and so on).
- Content is archived, never hard-deleted without explicit admin confirmation. Every source has an
  owning office.

## Current situation

UNC SSO and Carolina CloudApps (OKD) access are **requested but not granted**. Build and demo on
the local Docker stack with the mock auth provider. Interim hosts get public documents and fake
users only. Milestones and status are in [docs/roadmap.md](docs/roadmap.md).

## Layout

```
backend/    FastAPI app (app/), Alembic migrations (alembic/), pytest tests (tests/)
frontend/   React + TypeScript + Vite; nginx.conf.template for production
docs/       detailed design docs, roadmap, decision log
docker-compose.yml   local dev stack: db (Postgres + pgvector), backend, frontend
.github/workflows/   ci.yml (lint, tests, builds), branch-rules.yml (PR source/branch names)
```

## Commands

The Python venv is at the **repo root** (`.venv`), not in `backend/`. Use `.venv/bin/...` or an
activated venv; run backend commands from `backend/`.

- Full stack: `docker compose up --build` (app on 5173, API on 8000, Postgres on 5432)
- Backend tests: `cd backend && pytest`. They need Postgres running (`docker compose up -d db`)
  and migrate it themselves. Coverage must stay at **100%**; CI fails otherwise.
- Seed dummy data: `cd backend && python -m app.seed` (docker compose does this on startup). Sign
  in as `researcher1` or `admin1`.
- Backend lint: `cd backend && ruff check . && ruff format --check .`
- Frontend: `cd frontend && npm run lint && npm run build` (the build includes the type-check)
- New migration: `cd backend && alembic revision --autogenerate -m "..."`, then review the file.

Run the relevant tests and lint before saying a change is done.

## Architecture rules

- **API paths:** every FastAPI route is under `/api`. The frontend only uses relative `/api/...`
  paths through `frontend/src/api/client.ts`. Vite (dev) and nginx (prod) proxy `/api`. Don't
  hardcode backend URLs or add CORS workarounds.
- **API contract:** [docs/api.md](docs/api.md) defines every endpoint's shapes. It's mirrored in
  `backend/app/schemas/` (Pydantic) and `frontend/src/api/types.ts`. Change all three in the
  same PR, and add new endpoints to `api.md` before building them.
- **Database:** PostgreSQL + pgvector, accessed only through SQLAlchemy 2.0. Schema changes go
  through Alembic migrations, never manual SQL. Any Postgres works through `DATABASE_URL`, with no
  Supabase SDK or Supabase Auth. Schema design: [docs/database.md](docs/database.md).
- **Auth:** authentication is separate from authorization. The provider is chosen by
  `AUTH_PROVIDER` (`mock` now, `shibboleth` later). Roles come from our own `users` table. Routes
  use `get_current_user()` / `require_role()` and never read cookies or headers directly. Details:
  [docs/auth.md](docs/auth.md).
- **Config:** env vars via `app/config.py` (pydantic-settings). Never commit secrets. Document new
  variables in `.env.example`.
- **External AI calls** (LLM, embeddings) go behind interfaces with fake implementations. Tests
  never call real AI APIs. Pipeline design: [docs/rag.md](docs/rag.md).
- **Deployment:** images must run on OpenShift as non-root with an arbitrary UID; the frontend
  prod image listens on 8080. The same images run everywhere, configured by env vars. Details:
  [docs/deployment.md](docs/deployment.md).

## Git conventions

- Flow: `feature/*` → `dev` (default) → `qa` → `main`. Never commit directly to dev, qa or main.
- Branch names: `feature/`, `fix/`, `chore/`, `docs/`, `refactor/` or `test/` plus a lowercase
  name (`[a-z0-9._-]`). CI rejects PRs into dev that don't match.
- Commit messages: a short imperative title, a blank line, then a description of what changed and
  why. Only trivial changes (typos, formatting) may skip the description.
- Prefer several focused commits over one large one.
- Don't push, open PRs or merge unless the user asks.
