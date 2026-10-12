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
  email, affiliation), and the access timeline. *(David Cowig)*
- **OKD:** Postgres + pgvector availability, outbound API access, image registry, hostname,
  secrets. *(ITS)*
- **Repo:** must the repo move to a UNC GitHub organization? *(coach / ITS)*
- **Content:** which Research Policy Repository documents are approved to load, and in what format?
  *(Link)*
- **Referrals:** which office handles which topic, and what contact details should be shown?
  *(Link)*
- **Answer standards:** the exact disclaimer wording and the confidence/referral criteria. *(Link)*
- **Researcher home mockup:** the mockup puts a large inline Ask panel and answer below the three
  Browse/Search/Ask cards, which gives Ask more weight than the "equal prominence" rule allows.
  Is that intended? The mockup also has no disclaimer on its answer; we show one anyway. Its
  feedback buttons, Related Resources, Announcements and FAQs have no endpoints yet. The 9 topic
  names currently come from the mockup. *(Link)*

## Log

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
