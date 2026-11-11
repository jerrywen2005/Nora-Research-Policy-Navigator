# Database

**Status:** `users` is **Current** (migration `6ddc0a734e48`, 2026-10-12), and so are
`offices`, `topics`, `documents` and `document_topics` (migration `6de3ee5b4d8c`, 2026-10-13),
`document_chunks` (migration `2743ef7700b3`, 2026-11-10), `questions` and
`question_citations` (migration `b3f26accf7c2`, 2026-11-10), and `tags` and `document_tags`
(migration `3405a4fb20ce`, 2026-11-10).
Every other table is *Proposed*. Tables are added through Alembic migrations as features need them. Update this file
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
| parent_id | nullable self-reference. Not used for subtopics, which are `tags` (below) |
| default_office_id | the office to refer to for this topic |
| sort_order, is_active | |

**documents**: one row per source document (policy, SOP, guidance, FAQ page, web page, job aid).
| column | notes |
|---|---|
| id, title | |
| doc_type | `policy`, `standard`, `procedure`, `sop`, `guidance`, `faq`, `webpage`, `job_aid`, `other` |
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
| search_vector | generated `tsvector` with a GIN index, for keyword search. Weighted: title (A) > summary (B) > content_text (C). Search adds topic and tag names at weight B (see document_tags) |

**document_topics** (document_id, topic_id): a document can belong to several topics.

**tags**: subtopics, from the Link's tag inventory (77 tags, with definitions in
`backend/app/seed/data/policy_tags.json`; each policy's tags are in `policy_inventory.json`). Tags are
shared across all nine topics and have equal status: they aren't owned by a topic and aren't
ranked. Selecting a tag lists every policy with it, from any topic, which is how "related
policies" are found. A topic's subtopic filter is the set of tags its active documents use.
| column | notes |
|---|---|
| id, slug (unique), name (unique) | e.g. `training-education`, "Training & Education" |
| definition | the Link's "when to use" text; shown as help text and used as a retrieval glossary |

**document_tags** (document_id, tag_id): up to five tags per document (the Link's limit, enforced
by the admin API); the order of Tag 1–5 means nothing, so it isn't stored. Keyword search also
matches topic and tag names (F4); they're joined in at query time instead of being stored in
`documents.search_vector`, so renaming a tag needs no reindex.

**document_chunks**: the RAG units, built by `python -m app.rag` (`app/rag/ingest.py`).
| column | notes |
|---|---|
| id, document_id, chunk_index | unique (document_id, chunk_index); deleting a document deletes its chunks |
| section_heading | heading path, e.g. "2. Procedure > 2.1 Initial Determination"; shown in citations |
| context | "Document title > section heading", prepended to the text for embedding and search |
| text, word_count | the section's paragraphs; about 300 words at most |
| content_hash | the document's `content_hash` when the chunk was made; a mismatch means re-chunk |
| embedding | `vector(384)` (BAAI/bge-small-en-v1.5). No vector index: an exact scan over a few thousand chunks takes milliseconds, and an HNSW index can return fewer rows than asked for when combined with a `WHERE` filter. Add one only if the corpus grows by orders of magnitude |
| search_vector | generated `tsvector` with a GIN index: context (A) > text (B) |

When a document's text changes, ingestion deletes its chunks and makes new ones.

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

**questions**: one row per Ask, written by `POST /api/ask` (`app/rag/answer.py`).
| column | notes |
|---|---|
| id, user_id | user_id is nullable so it can be anonymized (see the open privacy question) |
| question_text | |
| topic_id | the topic the user asked from, nullable |
| outcome | `answered`, `referred`, `no_answer`, `error` (the LLM failed; the user saw sources and an office) |
| confidence | the best reranker score, 0 to 1 |
| answer_text | stored. It's small, and admins need it to review weak answers |
| referred_office_id | nullable |
| model, prompt_version, latency_ms | for comparing pipeline versions |
| parent_question_id | nullable; for multi-turn follow-ups later |
| created_at | |

**question_citations** (question_id, rank, chunk_id, document_id, score, was_cited): the chunks
retrieved for a question, best first (primary key: question_id + rank), and whether the answer
cited each. This drives the "most cited resources" analytics. `chunk_id` becomes null when
re-chunking deletes the chunk; `document_id` is stored alongside so counts survive.

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
