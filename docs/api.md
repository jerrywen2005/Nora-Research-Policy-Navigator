# API contract

**Status:** Agreed shapes for the Oct 14 demo (2026-10-11). The **Auth** endpoints are
implemented (2026-10-12), and so are **Topics** and **Documents** (2026-10-13); the rest are not
yet. Workflow D's endpoints (content management and subtopic tags, F3, F4, F12, NF7) are
implemented (2026-11-10): [Tags](#tags), [Offices](#offices), the tag filter and related
documents under [Documents](#documents), and [Admin: content management](#admin-content-management).

This is the agreement between backend and frontend about what each endpoint accepts and returns.
The same shapes appear in three places, and they must change together in the same PR:

| Where | For whom |
|---|---|
| this file | people |
| `backend/app/schemas/` (Pydantic) | the backend: response models must match exactly |
| `frontend/src/api/types.ts` | the frontend: the build fails if code uses a field that isn't here |

Until an endpoint exists, the frontend uses fake data typed with these shapes, then switches to
the real call. Nothing else should need to change.

## Conventions

- All paths start with `/api`. The frontend calls them through `frontend/src/api/client.ts`
  (`apiGet`, `apiPost`).
- JSON fields are `snake_case`, on both sides.
- Dates are `"YYYY-MM-DD"`. Timestamps are ISO 8601 with a timezone, e.g.
  `"2026-10-11T18:30:00Z"`. Missing values are `null`; fields are never left out.
- Auth uses a session cookie that the browser sends automatically. The frontend never handles
  tokens.
- Errors use FastAPI's default body, `{"detail": "message"}`:
  - `401`: not signed in. The frontend sends the user to the sign-in page.
  - `403`: signed in, but the wrong role.
  - `404`: not found.
  - `422`: invalid input.

## Auth

### `POST /api/auth/mock-login`
Mock provider only. It doesn't exist when `AUTH_PROVIDER=shibboleth`. An unknown Onyen is created
as a researcher.

Request:
```json
{ "onyen": "researcher1" }
```
Response `200`: a [User](#user). The session cookie is set.

### `POST /api/auth/logout`
Response `204`, with no body. The session cookie is cleared.

### `GET /api/me`
Response `200`: a [User](#user), or `401` if not signed in. The frontend calls this on load to
decide which view to show.

#### User
```json
{
  "id": 1,
  "onyen": "researcher1",
  "display_name": "Test Researcher",
  "email": "researcher1@unc.edu",
  "role": "researcher"
}
```
`role` is `"researcher"` or `"admin"`. `display_name` and `email` may be `null`.

## Topics

Topics and documents require sign-in (any role); signed out, they return `401`.

### `GET /api/topics`
Response `200`: a list of [Topic](#topic) for the active topics, ordered for display.

### `GET /api/topics/{slug}`
Response `200`: a [TopicDetail](#topicdetail), or `404`.

#### Topic
```json
{
  "id": 1,
  "slug": "human-subjects-research",
  "name": "Human Subjects Research",
  "description": "IRB review, consent, and protections for research participants.",
  "document_count": 4,
  "tags": [ { "id": 3, "slug": "irb-review-approval", "name": "IRB Review & Approval", "definition": "IRB submission review, approval criteria, ..." } ]
}
```
`tags` lists the [Tag](#tag)s on at least one active document in this topic, ordered
by name. It's the topic page's subtopic filter.

## Tags

Subtopic tags come from the Link's tag inventory. They're one shared list of equally weighted
labels: a tag isn't owned by a topic, and documents in any topic can carry it. A document has up to
five tags, in no particular order.

### `GET /api/tags`
Requires sign-in (any role). Response `200`: every [Tag](#tag), ordered by name. The admin tag
picker uses it.

#### Tag
`{ "id", "slug", "name", "definition" }`. `slug` is unique. `definition` is the
Link's "when to use" text, shown as a hint, and may be `null`. Definitions describe a discovery
label, not a policy requirement.

#### TopicDetail
A Topic plus the office that handles referrals for it:
```json
{
  "id": 1,
  "slug": "human-subjects-research",
  "name": "Human Subjects Research",
  "description": "IRB review, consent, and protections for research participants.",
  "document_count": 4,
  "tags": [],
  "office": {
    "id": 2,
    "name": "Office of Human Research Ethics",
    "email": "irb@example.unc.edu",
    "phone": "919-000-0000",
    "url": "https://research.unc.edu/human-research-ethics/"
  }
}
```
`office` may be `null`.

#### Office
`{ "id", "name", "email", "phone", "url" }`. Everything except `id` and `name` may be `null`.

## Offices

### `GET /api/offices`
Requires sign-in (any role). Response `200`: a list of [Office](#office), ordered by name. The
admin office picker uses it. Offices are only listed here, not edited.

## Documents

### `GET /api/documents`
Lists active documents. Used for both browse (filter by topic) and search (keyword).

Query parameters, all optional:
| name | meaning |
|---|---|
| `topic` | topic slug; only documents in that topic |
| `tag` | tag slug; only documents with that tag. Alone it finds the tag across every topic; with `topic`, only within that topic. An unknown `tag` returns no results, not `404` |
| `q` | keyword search over title, summary and content, and the names of the document's topics and tags (Postgres full-text search) |
| `limit` | default 20, max 100 |
| `offset` | default 0 |

With `q`, results are ordered by relevance (title matches rank above summary matches, which rank
above body matches; topic and tag names rank with the summary); without it, by
title. `q` uses web-search syntax: every word must match
(with stemming, so "exemptions" finds "exempt"), `"quoted phrases"` match in order, `or` gives
alternatives and `-word` excludes. A blank `q` is ignored. An unknown `topic` returns no results,
not `404`.

Response `200`:
```json
{
  "items": [ DocumentSummary, ... ],
  "total": 37
}
```
`total` is the number of matches before `limit`/`offset`, for showing "37 results".

### `GET /api/documents/{id}`
Response `200`: a [DocumentDetail](#documentdetail), or `404`. *Optional for Oct 14; until it
exists, results link straight to `source_url`.*

#### DocumentSummary
```json
{
  "id": 12,
  "title": "Use of Existing Data and Specimens in Research",
  "doc_type": "guidance",
  "citation": "OHRE SOP 1301",
  "source_url": "https://research.unc.edu/...",
  "summary": "When research using existing data needs IRB review.",
  "office": { "id": 2, "name": "Office of Human Research Ethics", "email": null, "phone": null, "url": null },
  "topics": [ { "id": 1, "slug": "human-subjects-research", "name": "Human Subjects Research" } ],
  "tags": [ { "id": 3, "slug": "irb-review-approval", "name": "IRB Review & Approval", "definition": "..." } ],
  "is_authoritative": true,
  "last_reviewed_at": "2026-08-01"
}
```
`doc_type` is one of `policy`, `standard`, `procedure`, `sop`, `guidance`, `faq`, `webpage`, `job_aid`, `other`.
`citation`, `source_url`, `summary`, `office` and `last_reviewed_at` may be `null`.
`tags` is a list of [Tag](#tag), ordered by name, possibly empty.

#### DocumentDetail
A DocumentSummary plus:
```json
{
  "content_text": "full text...",
  "related_documents": [
    { "id": 14, "title": "Human Subjects Research Exemptions", "doc_type": "guidance", "citation": null }
  ]
}
```
`related_documents` lists up to 5 other active documents that share at least one
tag with this one (F3), the most shared tags first and then by title. It's empty when the
document has no tags.

#### DocumentRef
`{ "id", "title", "doc_type", "citation" }`: the short form for links to a
document. `citation` may be `null`.

## Ask

### `POST /api/ask`
Request:
```json
{ "question": "Do I need IRB approval to use an existing dataset?", "topic": null }
```
`question` is 1–1000 characters and not blank (422 otherwise). `topic` is an optional topic slug
that narrows retrieval to that topic's documents; an unknown or inactive slug is 404. Requires
sign-in (401). Pipeline: [rag.md](rag.md#answering-post-apiask).

Response `200`:
```json
{
  "question_id": 41,
  "outcome": "answered",
  "answer": "Usually yes, unless the data are publicly available or fully de-identified. [1]",
  "citations": [
    {
      "number": 1,
      "document_id": 12,
      "title": "Use of Existing Data and Specimens in Research",
      "section": "When IRB review is required",
      "source_url": "https://research.unc.edu/...",
      "snippet": "Research using identifiable private information requires..."
    }
  ],
  "referral": null,
  "confidence": 0.82,
  "disclaimer": "Nora provides general information, not an official determination. Contact the responsible office for a formal review."
}
```
- `outcome`:
  - `"answered"`: `answer` cites `citations` as `[1]`, `[2]`, matching `number`. Only cited
    sources are listed.
  - `"referred"`: nothing in the policies matched (the confidence gate). `answer` is a short
    explanation, `citations` is empty, and `referral` is the [Office](#office) to contact: the
    topic's office when asked from a topic, otherwise the Office of the Vice Chancellor for
    Research.
  - `"no_answer"`: sources matched but the answer didn't cite them, or the LLM failed. `answer`
    is a short explanation, `referral` is the office that owns the best-matching policy, and
    after an LLM failure `citations` lists the matching sources.
- `confidence` is the best reranker score, 0 to 1. Below 0.04 the question is referred.
- With no LLM configured (`LLM_PROVIDER=none`, the default until UNC approves a provider),
  `outcome` is `"answered"`, `answer` is `null`, and `citations` lists the top matching sections
  as "relevant sources".
- `question_id` identifies the logged question; feedback will refer to it.
- The UI always shows `disclaimer`.

## Health

### `GET /api/health`
`{ "status": "ok" }`

## Admin: content management

Workflow D, requirements F12 and NF7. Every endpoint requires the admin role (`401` signed out,
`403` researcher). Unlike the researcher endpoints, these see documents of every status.

Admins edit a document's metadata only. Its text always comes from the Research Policy
Repository, which stays the authoritative copy, so there's no endpoint for editing `title`,
`citation` or `content_text`.

A document's lifecycle:

```
POST (import) → draft ──publish──→ active
                  │                  │
                  └────archive───────┴──→ archived ──restore──→ draft
                                             │
                                     DELETE ?confirm=true (permanent)
```

- Only `active` documents appear to researchers and in answers. Answers also need
  `is_authoritative` (NF1).
- **Restore** returns a document to `draft`, not `active`, so it goes through review and
  [publish](#post-apiadmindocumentsidpublish)'s checks again before researchers see it.
- A transition that isn't in the diagram (for example publishing an archived document) returns
  `409` with a `detail` that says why.
- Publishing, archiving and restoring, and edits to an active document's topics, tags or
  `is_authoritative`, will update its RAG chunks (`app/rag/ingest.py`) in the same request.
  *Not wired up yet.*

### `GET /api/admin/documents`
Lists documents of any status for the Policy Library page. Query parameters, all optional:

| name | meaning |
|---|---|
| `status` | `draft`, `active` or `archived`; omitted means all three |
| `topic` | topic slug |
| `q` | keyword search, as in [`GET /api/documents`](#get-apidocuments) |
| `limit` | default 20, max 100 |
| `offset` | default 0 |

With `q`, results are ordered by relevance; without it, by most recently updated first.
Response `200`: `{ "items": [ AdminDocument, ... ], "total": 37 }`.

### `GET /api/admin/documents/{id}`
Response `200`: an [AdminDocumentDetail](#admindocumentdetail), or `404`. The admin reviews a
draft's extracted text here before publishing it.

### `POST /api/admin/documents`
Imports a Research Policy Repository document by its link, as a draft.

Request:
```json
{ "source_url": "https://policies.unc.edu/TDClient/2833/Portal/KB/Article/132183" }
```
The link may be in the official `/KB/Article/{id}` form (optionally followed by `/{title}`) or
the `/KB/ArticleDet?ID={id}` form. Either way it's stored as the official
`https://policies.unc.edu/TDClient/2833/Portal/KB/Article/{id}`, the form the Link wants in
citations. Duplicates are detected by that article ID.
The backend fetches the article page and fills in `title` and `content_text`, with the page's
headings kept as Markdown (`## Purpose`) for RAG chunking. Repository pages have no summary or
citation field, so those start as `null`, and `doc_type` starts as `other` for the admin to set.
If the article is in the Link's tag inventory, its topic (from the Repository category) and its
tags are filled in from there; otherwise it starts with none. The office is always left for the
admin to choose, and `is_authoritative` starts `false`.

Response `201`: the [AdminDocumentDetail](#admindocumentdetail).
- `422`: `source_url` isn't a link to a Research Policy Repository article (host
  `policies.unc.edu`).
- `409`: a document for that Repository article already exists, in any status. `detail` names
  its id.
- `502`: the Repository page couldn't be fetched or had no article text.

### `PATCH /api/admin/documents/{id}`
Edits metadata. Every field is optional; omitted fields stay as they are, and a list replaces the
whole list.

Request:
```json
{
  "doc_type": "policy",
  "office_id": 2,
  "topic_ids": [1, 4],
  "tag_ids": [3],
  "is_authoritative": true
}
```
- `office_id` may be `null` to clear it, except on an `active` document (every published source
  has an owning office).
- `topic_ids` may be empty only on a draft or archived document.
- `tag_ids` holds at most 5 tags, from any topic (the Link's limit).

Response `200`: the [AdminDocumentDetail](#admindocumentdetail). `404` if the document doesn't
exist; `422` for an unknown id, more than 5 tags, or clearing the office or topics of an active
document.

### `POST /api/admin/documents/{id}/publish`
`draft` → `active`. The document must have an office and at least one topic, otherwise `409`
with a `detail` naming what's missing. Response `200`: the
[AdminDocumentDetail](#admindocumentdetail).

### `POST /api/admin/documents/{id}/archive`
`draft` or `active` → `archived`. Researchers and answers stop seeing it immediately. Response
`200`: the [AdminDocumentDetail](#admindocumentdetail); `409` if it's already archived.

### `POST /api/admin/documents/{id}/restore`
`archived` → `draft`. Response `200`: the [AdminDocumentDetail](#admindocumentdetail); `409` if
it isn't archived.

### `DELETE /api/admin/documents/{id}?confirm=true`
Permanently deletes an archived document with its chunks and its topic and tag links (NF7).
- Without `confirm=true`: `422`. The frontend sends it only after the admin confirms in a dialog
  that names the document.
- `409` if the document isn't archived. Archive it first.
- `404` if it doesn't exist.

Response `204`, with no body.

#### AdminDocument
A [DocumentSummary](#documentsummary) plus the fields admins need:
```json
{
  "id": 12,
  "title": "Use of Existing Data and Specimens in Research",
  "doc_type": "guidance",
  "citation": "OHRE SOP 1301",
  "source_url": "https://policies.unc.edu/TDClient/2833/Portal/KB/Article/132227",
  "summary": "When research using existing data needs IRB review.",
  "office": null,
  "topics": [],
  "tags": [],
  "is_authoritative": false,
  "last_reviewed_at": null,
  "status": "draft",
  "created_at": "2026-11-10T18:30:00Z",
  "updated_at": "2026-11-10T18:30:00Z",
  "updated_by": { "id": 2, "onyen": "admin1", "display_name": "Test Admin" }
}
```
`status` is `draft`, `active` or `archived`. `updated_by` is the last admin to change the document,
as `{ "id", "onyen", "display_name" }`, and may be `null` (seeded documents).

#### AdminDocumentDetail
An AdminDocument plus `"content_text": "full text..."`.

## Admin: managing admins (proposed, not built)

All three require the admin role (`401` signed out, `403` researcher). See
[auth.md](auth.md#admins).

### `GET /api/admin/admins`
Response `200`: a list of [User](#user), ordered by Onyen.

### `POST /api/admin/admins`
Request: `{ "onyen": "jlovmo" }`. Makes that Onyen an admin, creating the user if they've never
signed in (with `display_name` and `email` set to `null` until they do). Adding an existing
admin is a no-op.
Response `200`: the [User](#user).

### `DELETE /api/admin/admins/{onyen}`
Sets that user back to `researcher`.
Response `204`; `404` if the Onyen isn't an admin; `409` with
`{"detail": "Can't remove the last admin"}` if it's the only one.

## Not yet defined

Feedback, saved items, FAQs, usage logging and analytics, and editing topics, offices and tags
in the app. The admin Overview page is still a mockup with fake data. Add those endpoints here
before building them.
