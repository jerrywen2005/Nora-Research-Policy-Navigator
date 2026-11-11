# Roadmap

**Status:** Current as of 2026-11-10. Update the checkboxes and "Now" section as work lands.

## Milestones

| Date | Milestone |
|---|---|
| Wed Oct 14, 11:59 pm | Demo video: at least 1 core feature and 2 workflows, dummy data |
| ~~Oct 30~~ | ~~Quarterly client meeting~~ Cancelled (2026-10-27) |
| Mon Nov 2 | Team tech talk on RAG (20 min), done; the demo is in a separate tutorial repo |
| **Thu Nov 12** | **MVP due (course):** every MF requirement and at least 8 MNF ([product.md](product.md#requirements)) |
| Sun Nov 15 | Final product due (course) |
| Nov 19, 3–4 pm | RCC Steering Group demo: end-to-end researcher experience, with subtopic tags |
| End of semester (December) | Working prototype and handoff documentation for the client |

Client check-ins are every other week. Record each meeting in the website timeline/journal, and
put any decisions in [decisions.md](decisions.md).

## Now

The client's team handles hosting on Carolina CloudApps (OKD / Kubernetes), decided 2026-10-27.
Our only access dependency is UNC SSO (Connect Carolina): requested, and a reply to the auth
request has come in. Until SSO is set up, everything below is built and demoed on the local Docker
stack, with mock login. See
[deployment.md](deployment.md) and [auth.md](auth.md).

Building the five MVP workflows in [Phase 2](#phase-2-nov-10--nov-15-mvp-workflows). The Link's
policy and tag inventory (197 policies, 77 tags) is in; we're still waiting on the disclaimer and
citation wording and sample test questions ([decisions.md](decisions.md#open-questions)).

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
- [x] `offices`, `topics`, `documents`, `document_topics` tables + migration (Anton)
- [x] Seed: the 9 categories and 16 real public policies from the
  [UNC Policies Research knowledge base](https://policies.unc.edu/TDClient/2833/Portal/KB/Category/21680/Research),
  full text, with source URLs and the responsible offices' public contacts (Anton). Since
  replaced by the Link's 197-policy inventory in `backend/app/seed/data/policy_inventory.json`.
- [x] `GET /api/topics`, `GET /api/topics/{slug}`, `GET /api/documents?topic=&q=` (Postgres
  full-text search) and `GET /api/documents/{id}` (Anton)
- [x] Frontend: researcher home with Browse / Search / Ask given equal weight; topic cards →
  document list; search box; each result shows its citation and source link (Adithi; switched
  to the real API by Anton). See [frontend.md](frontend.md#researcher-pages). Ask moved to
  the real API on 2026-11-10.

Stretch, ask:
- [ ] `POST /api/ask` level 2: keyword retrieval, return the top sources, or a referral to the
  topic's office when nothing matches. No LLM needed.
- [ ] Level 3, if an API key is available: an LLM writes a cited answer from the retrieved
  snippets. The LLM sits behind an interface and is mocked in tests.

## Phase 2: Nov 10 – Nov 15, MVP workflows

Requirements: F1–F12 and NF1–NF10 in [product.md](product.md#requirements). F1 and F2 are
done; Phase 1 also built the browse and keyword-search parts of F3 and F4.

| | Workflow | Requirements | Backend | Frontend |
|---|---|---|---|---|
| A | Ask (RAG) | F5, F6 | Jerry | Jerry |
| B | Feedback and saved items | F7, F9 | Andy | Jerry |
| C | Usage logging and admin dashboard | F10, F11 | Andy | Jerry |
| D | Content management and subtopics | F3, F4, F12 | Adithi | Anton |
| E | FAQs | F8 | Anton | Adithi |

Each pair does its first workflow first (B before C, D before E). Before coding, each pair adds
its endpoints to [api.md](api.md) and its tables to [database.md](database.md), so backend and
frontend can work in parallel against the agreed shapes, as in Phase 1. Agree on the
`POST /api/ask` response first: B and C both need its `question_id`.

**Non-functional owners.** The MVP needs at least 8 of the 10. NF9 is done; the rest follow from
the workflows, so each has one owner who makes sure it's met and checked.

| | Requirement | Owner | How it's met |
|---|---|---|---|
| NF1 | Grounded answers only | Jerry | A: the gate and the grounding prompt |
| NF2 | Disclaimer and next step | Jerry | A: the answer panel and referral panel |
| NF3 | Measured answer quality | Jerry | A: the evaluation script, on the Link's questions when they arrive |
| NF4 | Concise, plain language | Jerry | A: the prompt, checked in the evaluation |
| NF5 | Response time | Jerry (Ask), Adithi (browse and search) | A, and D's search changes |
| NF6 | Privacy | Andy | C: aggregate-only analytics queries |
| NF7 | No silent deletes | Adithi | D: archive instead of delete, a confirmed hard delete |
| NF8 | Responsive, accessible, on-brand | Each screen's frontend owner; Anton checks every page at the end | All workflows |
| NF9 | Deployable on CloudApps | Andy | Done; keep the images and the deployment doc current |
| NF10 | Maintainable and handed off | Anton | CI is done; Anton writes the handoff documentation |

**A. Ask (Jerry).** Build plan: [rag.md](rag.md#plan-2026-10-27).
- [x] Tutorial RAG demo and write-up for the Nov 2 tech talk
- [x] Convert the Link's inventory spreadsheet to `app/seed/data/policy_inventory.json` and seed
  all 197 documents (title, link, topic, contact); D loads the tags from the same file
- [x] Ingestion: each policy's text → `document_chunks` with embeddings (`python -m app.rag`)
- [x] Hybrid retrieval (pgvector + BM25), reranking and the confidence gate threshold
- [x] Referral to the
  topic's office
- [x] `POST /api/ask` writes `questions` and `question_citations` and returns `question_id`
- [x] Ask page on the real API, with citations, the confidence indicator and the disclaimer;
  delete `fakeData.ts`
- [x] Evaluation script over test questions (`python -m app.rag eval`; ours first, the Link's
  when they arrive)
- [ ] Bring a typical answer under 10 s (NF5): rerank fewer candidates or benchmark a smaller
  reranker; retrieval alone is about 7 s on a laptop CPU

**B. Feedback and saved items (Andy backend, Jerry frontend).**
- [ ] `feedback` and `saved_items` tables and endpoints
- [ ] Helpful / not-helpful buttons on each answer
- [ ] Save buttons on answers and documents, a Saved page, and saved items in the right rail

**C. Usage logging and admin dashboard (Andy backend, Jerry frontend).**
- [ ] `usage_events` for topic views, document views and searches (terms, result count)
- [ ] Analytics endpoints for every measure in
  [product.md](product.md#admin-dashboard-must-have), for a date range, aggregates only
- [ ] CSV export
- [ ] Admin Overview on the real API; delete `sampleData.ts`

**D. Content management and subtopics (Adithi backend, Anton frontend).**
- [x] `tags` and `document_tags` ([database.md](database.md#content)); seed the 77 tags, their
  definitions and the document assignments from `policy_inventory.json`
- [x] Admin endpoints: add a document by Repository link (imported as a draft), publish, edit
  topic, tags, office and authoritative flag, archive and restore; hard delete needs confirmation
  ([api.md](api.md#admin-content-management))
- [ ] Changing a document re-runs ingestion for its chunks (coordinate with A)
- [x] Backend: search also matches topic and tag names; `GET /api/documents?tag=` lists every
  policy with a tag across topics; topics list their tags; documents return their tags and
  related policies
- [ ] Researcher pages for the above: tag page, tag filter on topic pages, tags and related
  policies on document pages
- [ ] Admin Policy Library and Content Management pages

**E. FAQs (Anton backend, Adithi frontend).**
- [ ] `faqs` table and endpoints; draft → published
- [ ] Admin FAQ editor
- [ ] Researcher FAQ page, and FAQs on their topic's page

## After the MVP

The "Perhaps" requirements (F13–F22), as time allows. Each goes to the people who built the
workflow it extends, so nobody has to learn a new part of the code:

| | Requirement | Owner | Extends |
|---|---|---|---|
| F13 | Plain-language search matching | Jerry (backend), Anton (frontend) | A's retrieval, D's search |
| F14 | Review dates | Adithi (backend), Anton (frontend) | D |
| F15 | Conflicting-content flags | Adithi (backend), Anton (frontend) | D; waits on the Link's decision |
| F16 | Dashboard filters | Andy (backend), Jerry (frontend) | C |
| F17 | UNC SSO | Jerry | The auth backend; waits on ITS ([auth.md](auth.md)) |
| F18 | Related questions | Jerry | A |
| F19 | Multi-turn follow-up | Jerry | A |
| F20 | Question grouping | Andy (backend), Jerry (frontend) | C, using A's embeddings |
| F21 | Document version history | Adithi (backend), Anton (frontend) | D |
| F22 | Admin list management (Users & Roles), plus the `ADMIN_ONYENS` bootstrap ([auth.md](auth.md#admins), [api.md](api.md#admin-managing-admins-proposed-not-built)) | Andy (backend), Adithi (frontend) | The auth backend |

Jerry's list is the longest, so if he's still on A, F18 and F19 wait and F13 goes to Adithi.

Improbable items (F23–F28, NF11–NF13) have no owners: we aren't building them.

- [ ] Handoff documentation for the client (Anton, NF10): architecture, conventions, deployment,
  maintenance, known limitations, next steps

## When access arrives

- OKD: deploy the existing images and move config into secrets and config maps
  ([deployment.md](deployment.md)).
- SSO: implement the Shibboleth provider and set `AUTH_PROVIDER=shibboleth` ([auth.md](auth.md)).
