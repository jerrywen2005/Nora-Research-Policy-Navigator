# Database

**Status:** `users` is **Current** (migration `6ddc0a734e48`, 2026-10-12). Every other table is
*Proposed*. Tables are added through Alembic migrations as features need them. Update this file
when a migration changes the schema.

## Where the database lives

Each developer runs a local Postgres 17 + pgvector container through `docker compose`. Migrations
in `backend/alembic/versions/` bring any database to the current schema, whichever one
`DATABASE_URL` points at: local, CI, an interim host, or OKD later. Deployment access is not needed
to develop the schema. Dummy data comes from a seed script, so every local database looks the same.

## Conventions

- Primary keys are `id bigint generated always as identity`.
- `Base.metadata` has a naming convention (`app/db.py`), so constraints get predictable names
  like `pk_users`, `uq_users_onyen` and `ck_users_role_valid`. Name CHECK constraints
  explicitly (`name="role_valid"`); the convention adds the prefix.
- Every model module is imported in `app/models/__init__.py`, which is how Alembic finds it.
  Add new models there.
- Timestamps are `timestamptz`, and `created_at` defaults to `now()`.
- Enums are stored as text with a CHECK constraint, which is easier to migrate than Postgres
  enum types.
- Aggregate analytics are computed with SQL queries over the event tables. Don't keep separate
  stats tables; at this scale (under 200 documents, low traffic) they aren't needed.
- Content is archived (`status = 'archived'`), never hard-deleted by normal app flows.

## Tables

### Users and access

**users**
| column | notes |
|---|---|
| id | |
| onyen | unique; the identity from SSO (mock login supplies it for now) |
| display_name, email | from SSO attributes, updated on login |
| role | `researcher` or `admin`, default `researcher` |
| is_active | |
| created_at, last_login_at | |

We use a single `role` column instead of `roles`/`user_roles`/`permissions` tables. There are
only two roles and nobody needs both, so the join tables would add complexity without any
benefit. Change this, with a migration and a decision-log entry, only if multiple roles per user
become a requirement.

### Content

**offices**: responsible offices. Used both for content ownership and for referrals.
| column | notes |
|---|---|
| id, name, description | |
| email, phone, url | contact details shown in referrals |

**topics**: the shared taxonomy for browsing documents and classifying questions, so the
analytics line up with the content.
| column | notes |
|---|---|
| id, slug (unique), name, description | |
| parent_id | nullable self-reference, for optional subtopics |
| default_office_id | the office to refer to for this topic |
| sort_order, is_active | |

**documents**: one row per source document (policy, SOP, guidance, FAQ page, web page, job aid).
| column | notes |
|---|---|
| id, title | |
| doc_type | `policy`, `sop`, `guidance`, `faq`, `webpage`, `job_aid`, `other` |
| citation | official policy number or reference, if any |
| source_url | link shown to users |
| summary | short description for browse and search results |
| content_text | full extracted text |
| content_hash | detects changed or duplicate uploads |
| office_id | the owning office |
| status | `draft`, `active`, `archived` |
| is_authoritative | only authoritative + active documents are used for answers |
| replaced_by_id | nullable self-reference when a newer document supersedes this one |
| effective_date, last_reviewed_at, review_due_at | for review cycles and "stale content" alerts |
| created_by, updated_by, created_at, updated_at | admin audit |
| search_vector | generated `tsvector` with a GIN index, for keyword search |

**document_topics** (document_id, topic_id): a document can belong to several topics.

**document_chunks**: the RAG units.
| column | notes |
|---|---|
| id, document_id, chunk_index | unique (document_id, chunk_index) |
| section_heading | for clearer citations |
| text, token_count | |
| embedding | `vector(N)` with an HNSW index. N depends on the embedding model (open question) |
| search_vector | generated `tsvector` for hybrid retrieval |

When a document is edited, its chunks are regenerated.

**faqs**: curated by admins, never auto-published.
| column | notes |
|---|---|
| id, question, answer, topic_id | |
| status | `draft`, `published`, `archived` |
| sort_order, created_by, updated_at | |

**faq_documents** (faq_id, document_id): the sources an FAQ cites.

FAQ candidates come from analytics queries over `questions` (frequent or similar questions).
Admins review them and write the FAQ.

### Usage and analytics

**questions**: one row per Ask.
| column | notes |
|---|---|
| id, user_id | user_id is nullable so it can be anonymized (see the open privacy question) |
| question_text | |
| topic_id | classified topic, nullable |
| outcome | `answered`, `referred`, `no_answer`, `error` |
| confidence | score from the pipeline |
| answer_text | stored. It's small, and admins need it to review weak answers |
| referred_office_id | nullable |
| model, prompt_version, latency_ms | for comparing pipeline versions |
| parent_question_id | nullable; for multi-turn follow-ups later |
| created_at | |

**question_citations** (question_id, chunk_id, document_id, rank, score, was_cited): what was
retrieved and what the answer actually cited. This drives the "most cited resources" analytics.
`document_id` is stored alongside the chunk so counts survive re-chunking.

**feedback**
| column | notes |
|---|---|
| id, question_id, user_id | unique (question_id, user_id) |
| helpful | boolean |
| comment | optional |
| created_at | |

**saved_items**: id, user_id, document_id or question_id (exactly one, enforced by a CHECK),
created_at.

**usage_events**: everything that isn't an Ask: `login`, `browse_topic`, `search`,
`view_document`, `open_source_link`, `view_faq`. Columns: id, user_id, event_type, topic_id,
document_id, query, result_count, created_at, `metadata jsonb`. Used for activity and
"most accessed" analytics.

## Not in the database

- Rate limiting: middleware, keyed by user. Low priority.
- Sessions: a signed cookie (see [auth.md](auth.md)). There's no sessions table unless we need
  server-side revocation.

## Differences from the original notes, and why

- `roles`, `user_role` and `permissions` are folded into `users.role`, because there are only two
  roles.
- `Research_Policies` is split into `documents` (what admins manage and users see) and
  `document_chunks` (what RAG retrieves).
- A document can have several topics. Questions and documents share one topic taxonomy.
- `offices` is added. Referrals and content ownership both need it.
- Telemetry is split into `questions`, `question_citations`, `feedback` and `usage_events`, so each
  dashboard metric is a simple query.
- Answer text is stored, because admins can't review unconfident answers without it, and it costs
  little storage.
- Lifecycle fields are added to documents (status, authoritative, replaced-by, review dates),
  because the proposal requires them.
