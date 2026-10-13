# Roadmap

**Status:** Current as of 2026-10-12. Update the checkboxes and "Now" section as work lands.

## Milestones

| Date | Milestone |
|---|---|
| Wed Oct 14, 11:59 pm | Demo video: at least 1 core feature and 2 workflows, dummy data |
| Oct 30 | Quarterly client meeting |
| Nov 19, 3–4 pm | Steering group showcase (end-to-end researcher experience) |
| End of November | Admin portal: content management and analytics |

Client check-ins are every other week. Record each meeting in the website timeline/journal, and
put any decisions in [decisions.md](decisions.md).

## Now

Carolina CloudApps (OKD) and UNC SSO access have been requested but not granted. Everything below
is built and demoed on the local Docker stack, with mock login. See
[deployment.md](deployment.md) and [auth.md](auth.md).

## Phase 1: Oct 14 demo

Agree on the shapes in [api.md](api.md) first. The frontend builds against fake data typed with
`frontend/src/api/types.ts` until the endpoints exist.

Team split (four people; each owns separate folders to avoid merge conflicts):

| # | Task | Owns |
|---|---|---|
| 1 | Auth backend (**Jerry**) | `app/models/user.py`, `app/auth/`, `app/api/auth.py`, `app/schemas/user.py`, `app/seed/users.py`, `app/seed/__main__.py` |
| 2 | Content and search backend, plus the Ask stretch (**Anton**) | `app/models/content.py`, `app/api/{topics,documents,ask}.py`, `app/schemas/content.py`, `app/seed/content.py` |
| 3 | Frontend shell, sign-in, admin mockup (**Andy**) | `src/main.tsx`, `src/App.tsx`, `src/layout/`, `src/theme.css`, `src/auth/`, `src/pages/SignIn*`, `src/pages/admin/` |
| 4 | Frontend researcher pages (**Adithi**) | `src/pages/researcher/`, `src/components/` |

Merge order:
- Person 3's app shell (router, layout, empty routes, the react-router dependency) and person 1's
  `users` migration merge first.
- Person 2 then sets their migration's `down_revision` to person 1's revision, so Alembic doesn't
  end up with two heads.
- Each backend person adds their own `include_router` line in `app/main.py`.
- Each person writes the tests for their own code. Backend tests share the fixtures in
  `backend/tests/conftest.py` (`db_session`, `client`, `make_user`, `login`).
- Anton: import your models in `app/models/__init__.py`, and call `seed_content(session)` from
  `run()` in `app/seed/__init__.py`.

Shared prerequisite:
- [x] Frontend app shell: react-router, layout, theme, placeholder routes
  ([frontend.md](frontend.md))


Workflow 1, mock login with role-based views:
- [x] `users` table + migration, seed script with `researcher1` and `admin1` (Jerry)
- [x] `POST /api/auth/mock-login`, `POST /api/auth/logout`, `GET /api/me` (Jerry)
- [x] `require_role(Role.ADMIN)` dependency; a researcher calling admin endpoints gets 403 (Jerry)
- [x] Frontend: sign-in page → researcher home or admin page (stub) by role; admin routes are
  guarded (Andy)
- [x] Test the frontend against the real auth endpoints, then delete `src/auth/fakeAuth.ts` and
  `VITE_FAKE_AUTH`
- [x] Frontend: admin Overview dashboard mockup with sample data (Andy)

Workflow 2, browse topics → search:
- [ ] `offices`, `topics`, `documents`, `document_topics` tables + migration
- [ ] Seed: the 9 categories and about 15 short public policy excerpts with citations and URLs
- [ ] `GET /api/topics`, `GET /api/documents?topic=&q=` (Postgres full-text search)
- [ ] Frontend: researcher home with Browse / Search / Ask given equal weight; topic cards →
  document list; search box; each result shows its citation and source link
  - Built and routed on fake data (Home, Browse, Topic, Search and Ask pages; see
    [frontend.md](frontend.md#researcher-pages)). Still to do: swap the bodies in
    `researcherApi.ts` for real calls once the endpoints land, then delete `fakeData.ts`.

Stretch, ask:
- [ ] `POST /api/ask` level 2: keyword retrieval, return the top sources, or a referral to the
  topic's office when nothing matches. No LLM needed.
- [ ] Level 3, if an API key is available: an LLM writes a cited answer from the retrieved
  snippets. The LLM sits behind an interface and is mocked in tests.

## Phase 2: Oct 15 – Oct 30, real knowledge base and RAG

- [ ] Ingestion script for Research Policy Repository documents → `documents` + `document_chunks`
  with embeddings
- [ ] Hybrid retrieval (pgvector + full-text), confidence check, referral logic
- [ ] `POST /api/ask` writes `questions` and `question_citations`
- [ ] Evaluation script over a set of test questions (ours first, the Link's later)
- [ ] Oct 30: demo grounded answers on real documents

## Phase 3: Oct 31 – Nov 19, researcher experience

- [ ] Feedback (helpful / not helpful), saved items, FAQ page, right rail, referral panel
- [ ] UNC branding, responsive layout
- [ ] Interim hosted URL if OKD isn't ready (public docs and fake users only)

## Phase 4: Nov 20 – end of November, admin portal

- [ ] Users & Roles: admin list editable in the app, plus the `ADMIN_ONYENS` bootstrap
  ([auth.md](auth.md#admins), [api.md](api.md#admin-managing-admins-proposed-not-built))

- [ ] Content management: documents, FAQs, topics, offices; authoritative flag, archive and
  replace, review dates
- [ ] Analytics: everything on the must-have list in [product.md](product.md#admin-dashboard-must-have), plus CSV export

## When access arrives

- OKD: deploy the existing images and move config into secrets and config maps
  ([deployment.md](deployment.md)).
- SSO: implement the Shibboleth provider and set `AUTH_PROVIDER=shibboleth` ([auth.md](auth.md)).
