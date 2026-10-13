# Decisions and open questions

Add a dated entry whenever a decision is made: who made it, and why. Newest entries go first. When
an open question is answered, move it into the log.

## Open questions

- **Privacy:** can telemetry (researchers' questions, Onyens) be stored off UNC infrastructure, for
  example in Supabase cloud or an interim host? Should questions be stored with user_id or
  anonymized, and for how long? *(clients / ITS)*
- **AI providers:** which LLM and embedding providers are approved for UNC use? This determines the
  embedding dimension in `document_chunks`. *(clients / ITS)*
- **SSO:** the integration pattern on CloudApps, which attributes come through (Onyen/eppn, name,
  email, affiliation), and the access timeline. *(David Cowig; emailed 2026-10-12, awaiting
  reply)*
- **OKD:** Postgres + pgvector availability, outbound API access, image registry, hostname,
  secrets. *(ITS)*
- **Repo:** must the repo move to a UNC GitHub organization? *(coach / ITS)*
- **Content:** which Research Policy Repository documents are approved to load, and in what format?
  *(Link)*
- **Referrals:** which office handles which topic, and what contact details should be shown?
  *(Link)*
- **Answer standards:** the exact disclaimer wording and the confidence/referral criteria. *(Link)*

## Log

### 2026-10-12: admins are one in-app list
There is one admin list that admins (Jeanne, to start) edit from the Users & Roles page; everyone
else is a researcher. The list is `users.role = 'admin'`. Admins can be added by Onyen before that
person's first sign-in. The last admin can't be removed. `ADMIN_ONYENS` only bootstraps the first
admin on a new deployment. Design: [auth.md](auth.md#admins); endpoints:
[api.md](api.md#admin-managing-admins-proposed-not-built). Not built yet; planned for the admin
portal phase. (Jerry)

### 2026-10-12: frontend fake auth removed
The real auth endpoints are on dev, so `frontend/src/auth/fakeAuth.ts` and `VITE_FAKE_AUTH` are
deleted. Sign-in always goes through the backend. This was cleanup, not a security fix: the fake
only changed what the browser showed, and the backend has always enforced sessions and roles.

### 2026-10-12: mock auth built; SSO request sent
Jerry emailed David Cowig to request UNC SSO access; there's no reply yet. Mock auth is
implemented: a signed session cookie holding only the user id, and role re-read from the
database on every request. Production refuses mock auth and the default session secret. The
backend tests run against real Postgres, inside a transaction that is rolled back after each test
(`tests/conftest.py`).

### 2026-10-12: Oct 14 task owners
Jerry: auth backend. Anton: content and search backend (plus the Ask stretch). Andy: frontend
shell, sign-in and admin mockup. Adithi: frontend researcher pages.

### 2026-10-12: demo sign-in page doesn't imitate UNC's login
The mock sign-in page uses Nora's own theme and is labeled "Demo sign-in. UNC SSO will replace
this." It doesn't copy the look of UNC's real Onyen/SSO page, so the demo can't be mistaken for (or
used as) a real UNC login. This replaces the earlier plan in [auth.md](auth.md) to style it after
the Onyen login. A temporary `VITE_FAKE_AUTH` mode lets the frontend run before the backend auth
endpoints land. (Andy, person 3)

### 2026-10-12: frontend shell
React Router v7 in declarative mode, one shared `AppLayout` for the researcher and admin areas,
and plain CSS with UNC colors as variables in `theme.css` (no CSS framework). Navy is used for
text and links, and Carolina Blue only for accents, because Carolina Blue on white is too low
contrast to read. Nav items without a page show disabled with a "Soon" tag. See
[frontend.md](frontend.md). (Andy, person 3)

### 2026-10-11: API contract and team split
[api.md](api.md) and `frontend/src/api/types.ts` define the shapes for auth, topics, documents and
ask, so backend and frontend can be built in parallel. JSON is snake_case, the session is a cookie,
and errors are FastAPI's `{"detail": ...}`. The work is split four ways by folder ownership (see
[roadmap.md](roadmap.md)).

### 2026-10-11: database schema proposal
Proposed schema in [database.md](database.md):
- a single `users.role` column
- documents and chunks as separate tables
- a shared topic taxonomy
- an `offices` table
- telemetry split into questions, citations, feedback and usage events

Status: proposed, pending team review.

### 2026-10-11: build without OKD or SSO for now
Both access requests are pending. Development and demos use the local Docker stack and a mock auth
provider behind an interface (`AUTH_PROVIDER`), so switching to UNC SSO and OKD later is a config
change plus one new provider. Any interim public host gets only public documents and fake users.

### 2026-10-11: Oct 14 demo scope
Workflow 1: mock login → role-based researcher or admin view, with backend role enforcement.
Workflow 2: browse topics → list and search seeded documents. Stretch: Ask, using keyword
retrieval with referral fallback, plus an LLM answer if a key is available.

### 2026-10-11: client proposal received
The project is named "Nora". The Research Policy Navigator Link (led by Jeanne Lovmo) owns
requirements, content standards, test scenarios and UAT. The Research Policy Repository is the
primary knowledge source. New requirements: source owners and review cycles, surfacing
conflicting or outdated content, and "most cited resources" analytics.

### Earlier (September 2026)
- The Oct 30 website showcase was dropped. The steering group showcase is Nov 19, 3–4 pm.
- Stack: FastAPI + SQLAlchemy/Alembic, Postgres + pgvector, React + TypeScript + Vite. If
  Supabase is used at all, it's only as a hosted Postgres, never Supabase Auth.
- Git flow: `feature/*` → `dev` → `qa` → `main`, enforced in CI. 100% backend test coverage.
- Deployment target: Carolina CloudApps (OKD).
