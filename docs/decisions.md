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
  email, affiliation), and the access timeline. *(ITS / David Cowig; a reply to the auth request
  has come in, details to be recorded)*
- **OKD:** Postgres + pgvector availability, outbound API access, image registry, hostname,
  secrets. *(client's team, who now own hosting)*
- **Repo:** must the repo move to a UNC GitHub organization? *(coach / ITS)*
- **Referrals:** the inventory gives each policy's contact. Is that who Nora should refer to, and
  who handles questions that match no policy? *(Link)*
- **Answer standards:** the exact disclaimer wording, the citation and source-link format, and the
  confidence/referral criteria. *(Link; asked for in Jeanne's 2026-10-29 email)*
- **Untagged policy:** Research Service Centers procedure (article 132340) has no tag yet; the
  inventory's review notes say a reviewer must confirm one. *(Link)*
- **Test questions:** sample researcher questions and use cases for the evaluation. *(Link)*
- **MVP requirements sign-off:** does the Link approve the revised D1 requirements
  ([product.md](product.md#requirements))? *(Link)*
- **Researcher home mockup:** the mockup puts a large inline Ask panel and answer below the three
  Browse/Search/Ask cards, which gives Ask more weight than the "equal prominence" rule allows.
  Is that intended? The mockup also has no disclaimer on its answer; we show one anyway. Its
  feedback buttons, Related Resources, Announcements and FAQs have no endpoints yet. The 9 topic
  names currently come from the mockup. *(Link)*

## Log

### 2026-11-10: the Link's policy and tag inventory
The Link's `Nora_Policy_Tag_Inventory_Updated_2026.10.28.xlsx` (dated Oct 28; the docs wrongly
said the tags hadn't arrived) is the inventory Jeanne's Oct 29 email promised. It settles:
- **Scope:** Nora's initial knowledge source is all **197** Research Policy Repository policies,
  not the 16 we seeded. Each row has the category, article ID, title, direct link, issuing
  officer, responsible unit and policy contact (194 with an email).
- **Tags:** 77 tags, each with a definition, up to five per policy (196 of 197 tagged). Tags are
  **shared across categories with equal status**: Tag 1–5 is not a ranking or hierarchy, and
  selecting a tag should find policies in any category. This replaces our earlier "tags belong to
  one topic" design: `tags` has no `topic_id` ([database.md](database.md#content)), and D1 F3 now
  says a tag lists every policy with it, across topics.
- **Topics:** its nine Repository categories match our nine seeded topics one to one.

Plan: Jerry converts the spreadsheet to `backend/app/seed/data/policy_inventory.json` and seeds
the 197 documents for ingestion; Adithi seeds the tags from the same file. The tag definitions
also start the retrieval glossary ([rag.md](rag.md)). *(Jerry)*

### 2026-11-10: MVP requirements narrowed
The original D1 spec (F1–F34, NF1–NF13) overlapped, was hard to test, and was one-third things we
won't build. It's narrowed to 12 functional (F1–F12) and 10 non-functional (NF1–NF10) Definite
requirements, each checkable, based on the Link proposal and Jeanne's emails. The MVP needs every
functional requirement and at least 8 non-functional ones. Main changes from D1:
- **Added:** subtopic tags (Jeanne's 2026-10-29 email), usage logging for browse and search (her
  dashboard asks for Browse, Search and Ask measures), most-cited resources, and a draft → review
  → publish step for content ("add, review, update, and remove" in the proposal).
- **Promoted to required:** FAQs (named in the proposal's admin list), saved items (Jerry), and
  CSV export (the proposal says "analytics and reporting").
- **Narrowed:** content management imports documents by Repository link and edits metadata only.
  The Repository stays the authoritative text, so there's no in-app text editor. "Most frequent
  questions" counts exact matches; grouping similar questions stays a "Perhaps".
- **Dropped:** portable hosting on Vercel/Render (the client hosts on CloudApps), and naming
  specific AI providers in the interfaces.

D1 on the website is revised in place, since it's the requirements document we submit; the old
F1–F34 list is in the website's git history. A separate MVP page was tried and dropped because it
only repeated D1. Summary: [product.md](product.md#requirements). It's our draft until the Link
approves it. *(Jerry, after Anton suggested narrowing the list)*

### 2026-11-10: owners for the non-functional and Perhaps requirements
Each non-functional requirement has one owner who makes sure it's met (most fall to Jerry through
Ask), and each Perhaps requirement goes to whoever built the workflow it extends. Improbable items
have no owners. The admin list (Users & Roles) is now Perhaps F22, and D1's interfaces keep the
mockup's right rail and the answer's confidence indicator, which the frontend already partly
builds. Tables in [roadmap.md](roadmap.md#phase-2-nov-10--nov-15-mvp-workflows). *(Jerry)*

### 2026-11-10: MVP workflow owners
Five workflows remain. Jerry builds Ask (RAG) end to end. The rest are split between two pairs,
each workflow with one backend and one frontend owner: Andy (backend) and Jerry (frontend) take
feedback and saved items, then usage logging and the admin dashboard; Adithi and Anton take
content management with subtopics (Adithi backend, Anton frontend), then FAQs (Anton backend,
Adithi frontend). Details in [roadmap.md](roadmap.md). *(Jerry)*

### 2026-11-10: subtopics are tags, built before the client's list arrives
Subtopics are tags that belong to one of the nine topics and can be shared by documents across
topics (Jeanne: tags "help users find related policies across topics"). So they're a `tags` table
plus a `document_tags` join, not child rows in `topics`. We build the tables, admin editing and
filtering now, hide the tag UI while there are no tags, and load the Link's tags when they
arrive. We don't make up placeholder tags, because the Link defines the taxonomy. See
[database.md](database.md#content). *(Jerry)*

### 2026-10-29: client follow-up email and course deadlines
Jeanne's summary of the Oct 27 meeting:
- The UNC Research Policy Repository is the initial knowledge source.
- Tags ("subtopics") for each of the nine topics are to be added to the app and to retrieval
  before the **Nov 19 RCC Steering Group** demo.
- Nora answers only from approved sources, with citations and links, an AI disclaimer, and a
  referral when it can't answer confidently.
- The client expects a working prototype by the **end of the semester in December**, plus handoff
  documentation (architecture, coding conventions, deployment, maintenance, known limitations,
  next steps).
- Jeanne and Amanda Chang owe us: the document inventory with links and tags, sample test
  questions, referral offices, and the citation and disclaimer preferences.

Her dashboard guidance asks for aggregate patterns (Browse, Search and Ask activity, common
search terms, searches with no useful result, referrals, helpfulness, trends over time), not
views of individual researchers.

At the same day's coach meeting (Vinir Rai), the course deadlines were set: **MVP Thu Nov 12**,
final product **Sun Nov 15**.

### 2026-10-29: reply received on the SSO request
A reply to our UNC SSO (auth) request has come back. Its details still need to be added to
[auth.md](auth.md) and the SSO open question above. *(Jerry)*

### 2026-10-27: client's team handles Kubernetes; we handle SSO
At the client meeting, UNC Research decided their team will handle the Kubernetes (Carolina
CloudApps / OKD) deployment. We only need to integrate Connect Carolina SSO. We keep the images
OpenShift-ready and document what the deployment needs. See [deployment.md](deployment.md).

### 2026-10-21: access requests sent to ITS
Andy and Anton emailed ITS about UNC SSO and Kubernetes (OKD) hosting. This was in addition to
Jerry's 2026-10-12 SSO email to David Cowig.

### 2026-10-27: Oct 30 milestone cancelled; RAG doubles as the tech talk
The Oct 30 milestone (quarterly client meeting and its grounded-answer demo) was cancelled. Anton
and Jerry own the RAG pipeline. The team tech talk on Mon Nov 2 is about RAG, and the pipeline is
its demo: a standalone tutorial version first, then Nora's production pipeline for the Nov 19
showcase. The build plan and proposed split are in [rag.md](rag.md#plan-2026-10-27), pending
Jerry's review. *(Anton)*

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
