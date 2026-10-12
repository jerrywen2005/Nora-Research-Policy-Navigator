# Project docs

Detailed design and project records for Nora. [CLAUDE.md](../CLAUDE.md) holds the short, general
rules; these files hold the detail. [README.md](../README.md) at the repo root covers setup.

| File | What it covers |
|---|---|
| [product.md](product.md) | Clients, the Link, users, product rules and requirements |
| [api.md](api.md) | API contract: every endpoint's request and response shape |
| [roadmap.md](roadmap.md) | Milestones, phases, current status and what's next |
| [decisions.md](decisions.md) | Dated decision log and open questions |
| [database.md](database.md) | Schema: tables, columns, and why |
| [auth.md](auth.md) | Mock login now, UNC SSO later, roles |
| [frontend.md](frontend.md) | Routes, layout, navigation and styling conventions |
| [rag.md](rag.md) | Ingestion, retrieval, the ask pipeline and evaluation |
| [deployment.md](deployment.md) | Environments, Carolina CloudApps (OKD), interim hosting |

## Keeping them current

These docs are the project's memory. A new teammate or a fresh Claude session knows only what is
written here, so:

- When a decision is made or new information arrives (a client or coach meeting, an answered open
  question, a changed requirement), update the matching file and add a dated entry to
  [decisions.md](decisions.md) in the same change.
- When code changes something documented here (schema, endpoints, auth flow), update the doc in
  the same PR.
- Each file has a **Status** line. Mark designs as *Proposed* until they are built, then *Current*.
- If a doc and the code disagree, the code shows what exists. Fix the doc, or ask which one is
  intended.
