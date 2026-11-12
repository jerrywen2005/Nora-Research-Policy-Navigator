# API contract

**Status:** Agreed shapes for the Oct 14 demo (2026-10-11). The **Auth** endpoints are
implemented (2026-10-12), and so are **Topics** and **Documents** (2026-10-13); the rest are not
yet. Workflow D's endpoints (content management and subtopic tags, F3, F4, F12, NF7) are
implemented (2026-11-10): [Tags](#tags), [Offices](#offices), the tag filter and related
documents under [Documents](#documents), and [Admin: content management](#admin-content-management).
Workflow E's endpoints ([FAQs](#faqs) and [Admin: FAQs](#admin-faqs), F8) are implemented
(2026-11-11).

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
  "contacts": [
    { "id": 2, "name": "Office of Human Research Ethics", "email": "irb_questions@unc.edu", "phone": "919-966-3113", "url": "https://research.unc.edu/human-research-ethics/" },
    { "id": 9, "name": "Research Compliance Services", "email": "rcs@unc.edu", "phone": null, "url": null }
  ],
  "confidence": 0.82,
  "disclaimer": "Nora provides general information, not an official determination. For a formal review, contact one of the offices below.",
  "links": []
}
```
- `outcome` (who to contact is the Link's rule, 2026-11-12):
  - `"answered"`: `answer` cites `citations` as `[1]`, `[2]`, matching `number`. Only cited
    sources are listed. `contacts` is the offices that own the cited policies, then Research
    Compliance Services (RCS).
  - `"referred"`: the question is about research, but nothing in the policies matched (the
    confidence gate). `answer` is a short explanation, `citations` is empty, and `contacts` is
    RCS.
  - `"out_of_scope"`: not about research, either below the gate or when the sources matched
    words but the LLM found no answer in them (e.g. "pets in dorms" and the animal policies). `answer` is a short explanation,
    `contacts` is the University Policy Office, and `links` points to every UNC policy.
  - `"no_answer"`: sources matched but the answer didn't cite them, or the LLM failed. `answer`
    is a short explanation and `contacts` is RCS; after an LLM failure `citations` lists the
    matching sources and `contacts` is their offices, then RCS.
- Below the gate, the LLM decides between `referred` and `out_of_scope`. Without an LLM, only a
  question far from every policy is `out_of_scope` ([rag.md](rag.md), build log).
- `contacts` is a list of [Office](#office), most specific first; it is never empty once the
  two referral offices are seeded. `links` is a list of `{ "title", "url" }`, usually empty.
- `disclaimer` comes with policy content (`answered`, and `no_answer` with sources) and is
  `null` on a referral, which has no content to qualify. Show it whenever it's set; the backend
  (`app/rag/answer.py`) is the only copy of the wording.
- `confidence` is the best reranker score, 0 to 1. Below 0.04 the question is referred.
- With no LLM configured (`LLM_PROVIDER=none`, the default until UNC approves a provider),
  `outcome` is `"answered"`, `answer` is `null`, and `citations` lists the top matching sections
  as "relevant sources".
- `question_id` identifies the logged question; feedback will refer to it.

## Feedback and saved items

Workflow B (F7, F9). Every endpoint requires sign-in (`401`) and only ever reads or changes the
current user's own rows (NF6). There is no admin access to another user's feedback or saved
items; the dashboard will show aggregates only.

### `PUT /api/questions/{question_id}/feedback`
Rates an answer: helpful or not helpful, with an optional comment. Calling it again replaces the
earlier rating (one per question per user), so the UI can switch between the two buttons.

Request:
```json
{ "helpful": false, "comment": "It didn't cover student researchers." }
```
`comment` is optional, at most 1000 characters (`422` otherwise); a blank comment is stored as
`null`.

Response `200`: a [Feedback](#feedback).

Only the user who asked the question can rate it. Someone else's question, or one that doesn't
exist, is `404`, so the response doesn't reveal that it exists.

### `DELETE /api/questions/{question_id}/feedback`
Removes the current user's rating (undo). Response `204`. `404` if the question isn't theirs or
they haven't rated it.

#### Feedback
```json
{
  "question_id": 41,
  "helpful": false,
  "comment": "It didn't cover student researchers.",
  "created_at": "2026-11-11T15:02:00Z",
  "updated_at": "2026-11-11T15:04:30Z"
}
```
`comment` may be `null`. `updated_at` equals `created_at` until the rating is changed.

### `GET /api/saved`
Response `200`: a list of [SavedItem](#saveditem) for the current user, newest first. Not paged;
a user saves at most a few dozen items.

### `POST /api/saved`
Saves a document or one of the user's own questions. Send exactly one of the two ids (`422` if
both or neither):
```json
{ "document_id": 12 }
```
```json
{ "question_id": 41 }
```
- Response `201`: the new [SavedItem](#saveditem).
- Saving something already saved returns the existing item with `200`, so a double click is
  harmless.
- `404` for an unknown or archived document, or for a question that doesn't exist or belongs to
  someone else.

### `DELETE /api/saved/{id}`
Response `204`. `404` if the item doesn't exist or belongs to another user.

#### SavedItem
```json
{
  "id": 7,
  "created_at": "2026-11-11T15:10:00Z",
  "kind": "question",
  "document": null,
  "question": {
    "id": 41,
    "question_text": "Do I need IRB approval to use an existing dataset?",
    "outcome": "answered",
    "answer_text": "Usually yes, unless the data are publicly available or fully de-identified. [1]",
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
    "contacts": [
      { "id": 9, "name": "Research Compliance Services", "email": "rcs@unc.edu", "phone": null, "url": null }
    ],
    "disclaimer": "Nora provides general information, not an official determination. For a formal review, contact one of the offices below.",
    "links": [],
    "created_at": "2026-11-11T15:01:12Z"
  }
}
```
- `kind` is `"document"` or `"question"`. Exactly one of `document` and `question` is set,
  matching `kind`; the other is `null`.
- `document` is a [DocumentSummary](#documentsummary).
- `question.outcome` is an Ask `outcome` (`answered`, `referred`, `out_of_scope`,
  `no_answer`). A question whose LLM call failed is stored as `error` in the database but shown as `no_answer`, as it was when
  asked.
- `question.answer_text` is the answer shown at the time, with its `[n]` markers, or `null` when
  there was none (for example with no LLM configured).
- `question.citations`, `contacts`, `disclaimer` and `links` are what the Ask page showed with
  the answer, in the same shapes as `POST /api/ask`, rebuilt by the same code
  (`app/rag/answer.py`) from the stored outcome, cited policies and referred office:
  - `citations` lists only the sources the answer cited, ordered by `number` (their retrieval
    rank). `number` matches the `[n]` in `answer_text`. This order can differ from the Ask
    response, which lists them in the order the answer first mentions them. Empty for a referral.
  - If the policy has been re-processed since, its old sections are gone: the citation keeps its
    `number`, `document_id`, `title` and `source_url`, and `section` and `snippet` are `""`.
- A saved document that is later archived stays in the list, so the user can still see it and
  remove it.

## FAQs

Workflow E, requirement F8. Admins write FAQs (see [Admin: FAQs](#admin-faqs)); researchers see
only published ones. Requires sign-in (`401` otherwise), any role.

### `GET /api/faqs`
Published FAQs, ordered by `sort_order`, then question. Query parameters, both optional:

| name | meaning |
|---|---|
| `topic` | topic slug; only that topic's FAQs, for its topic page. An unknown slug gives `[]` |

Response `200`: `[ Faq, ... ]`. There are few FAQs, so the list isn't paged.

#### Faq
```json
{
  "id": 3,
  "question": "Do I need IRB approval to use existing de-identified data?",
  "answer": "Usually not, if you can't link the data back to individuals...",
  "topic": { "id": 1, "slug": "human-subjects-research", "name": "Human Subjects Research" },
  "sources": [
    { "id": 12, "title": "Use of Existing Data and Specimens in Research", "doc_type": "guidance", "citation": "OHRE SOP 1301" }
  ],
  "updated_at": "2026-11-12T18:30:00Z"
}
```
- `answer` is Markdown, written by an admin. Render it with the same safe Markdown renderer as
  Ask answers.
- `topic` is a [TopicRef](#documentsummary); it's `null` only if the FAQ's topic was removed.
- `sources` are the policies the answer is based on, as [DocumentRef](#documentref)s. Researchers
  only see sources that are `active`, so the list can be empty.

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

## Admin: FAQs

Workflow E, requirements F8 and NF7. Every endpoint requires the admin role (`401` signed out,
`403` researcher). These see FAQs of every status. FAQs are never auto-published: an admin writes
each one and publishes it.

An FAQ's lifecycle is the same as a document's, except the published status is `published`:

```
POST → draft ──publish──→ published
         │                  │
         └────archive───────┴──→ archived ──restore──→ draft
                                    │
                            DELETE ?confirm=true (permanent)
```

A transition that isn't in the diagram returns `409` with a `detail` that says why.

### `GET /api/admin/faqs`
Lists FAQs of any status for the admin FAQ editor, ordered by `sort_order`, then question. Query
parameters, both optional:

| name | meaning |
|---|---|
| `status` | `draft`, `published` or `archived`; omitted means all three |
| `topic` | topic slug |

Response `200`: `[ AdminFaq, ... ]`.

### `GET /api/admin/faqs/{id}`
Response `200`: an [AdminFaq](#adminfaq), or `404`.

### `POST /api/admin/faqs`
Creates a draft.

Request:
```json
{
  "question": "Do I need IRB approval to use existing de-identified data?",
  "answer": "Usually not, if you can't link the data back to individuals...",
  "topic_id": 1,
  "document_ids": [12],
  "sort_order": 0
}
```
- `question` (up to 500 characters) and `answer` (up to 10,000) are required and can't be blank.
- `topic_id` may be `null` or left out on a draft; `document_ids` defaults to `[]` and
  `sort_order` to `0`.
- `document_ids` may name documents of any status, but researchers only see the active ones.

Response `201`: the [AdminFaq](#adminfaq). `422` for a blank field or an unknown id.

### `PATCH /api/admin/faqs/{id}`
Edits an FAQ. Every field from `POST` is optional; omitted fields stay as they are, and
`document_ids` replaces the whole list. Edits to a published FAQ show to researchers immediately.
- `topic_id` may be `null` to clear it, except on a `published` FAQ.
- `question`, `answer`, `document_ids` and `sort_order` can't be `null`.

Response `200`: the [AdminFaq](#adminfaq). `404` if the FAQ doesn't exist; `422` for a blank or
`null` field, an unknown id, or clearing a published FAQ's topic.

### `POST /api/admin/faqs/{id}/publish`
`draft` → `published`. The FAQ must have a topic, otherwise `409`. Response `200`: the
[AdminFaq](#adminfaq).

### `POST /api/admin/faqs/{id}/archive`
`draft` or `published` → `archived`. Researchers stop seeing it immediately. Response `200`: the
[AdminFaq](#adminfaq); `409` if it's already archived.

### `POST /api/admin/faqs/{id}/restore`
`archived` → `draft`. Response `200`: the [AdminFaq](#adminfaq); `409` if it isn't archived.

### `DELETE /api/admin/faqs/{id}?confirm=true`
Permanently deletes an archived FAQ and its source links (NF7).
- Without `confirm=true`: `422`. The frontend sends it only after the admin confirms in a dialog
  that names the FAQ.
- `409` if the FAQ isn't archived. Archive it first.
- `404` if it doesn't exist.

Response `204`, with no body.

#### AdminFaq
A [Faq](#faq) plus the fields admins need. Its `sources` include every linked document, whatever
its status.
```json
{
  "id": 3,
  "question": "Do I need IRB approval to use existing de-identified data?",
  "answer": "Usually not, if you can't link the data back to individuals...",
  "topic": { "id": 1, "slug": "human-subjects-research", "name": "Human Subjects Research" },
  "sources": [
    { "id": 12, "title": "Use of Existing Data and Specimens in Research", "doc_type": "guidance", "citation": "OHRE SOP 1301" }
  ],
  "updated_at": "2026-11-12T18:30:00Z",
  "status": "draft",
  "sort_order": 0,
  "created_at": "2026-11-12T18:00:00Z",
  "updated_by": { "id": 2, "onyen": "admin1", "display_name": "Test Admin" }
}
```

## Admin analytics

Workflow C, requirements F10, F11 and NF6: the data behind the admin Overview dashboard, every
measure in [product.md](product.md#admin-dashboard-must-have). Both endpoints require the admin
role (`401` signed out, `403` researcher).

**Aggregates only (NF6).** No response contains a user id, Onyen, name, email or any per-user
row. Users appear only as counts. Free-text lists (search terms, questions) show the text and a
count, and only for text used by at least `min_distinct_users` different people; anything rarer
is left out of the list but still counted in the totals. *The threshold of 2 is proposed and
awaiting confirmation; see [decisions.md](decisions.md).*

**Dates.** `from` and `to` are calendar dates (`YYYY-MM-DD`) in UNC's time zone,
`America/New_York`, and both are inclusive: `from=2026-11-01&to=2026-11-07` covers 00:00 on
Nov 1 to the end of Nov 7, Eastern. Every measure counts only activity inside the range.

**Sources.** Asks come from `questions` and `question_citations` (written by `POST /api/ask`),
ratings from `feedback`, and everything else from `usage_events`
([database.md](database.md#usage-and-analytics)), which these endpoints write as a side effect:

| endpoint | event |
|---|---|
| `POST /api/auth/mock-login` (and the SSO login later) | `login` |
| `GET /api/topics/{slug}` | `topic_view` |
| `GET /api/documents/{id}` | `document_view` |
| `GET /api/documents` with `q`, first page only (`offset=0`) | `search`, with the trimmed, lowercased text and `total` |

Logging never changes a response or fails a request.

### `GET /api/admin/analytics`
Query parameters, both optional:

| name | meaning |
|---|---|
| `from` | first day, inclusive. Default: 29 days before `to` (30 days in all) |
| `to` | last day, inclusive. Default: today |

`422` if `to` is before `from`, if the range is longer than 366 days, or if a date isn't
`YYYY-MM-DD`.

Response `200`: an [Analytics](#analytics) object.

#### Analytics
```json
{
  "from": "2026-10-13",
  "to": "2026-11-11",
  "min_distinct_users": 2,

  "activity": { "active_users": 42, "logins": 118 },

  "interactions": { "topic_views": 310, "document_views": 522, "searches": 204, "questions": 97 },

  "top_topics": [
    { "topic": { "id": 1, "slug": "human-subjects-research", "name": "Human Subjects Research" }, "count": 88 }
  ],
  "top_documents": [
    { "document_id": 12, "title": "Use of Existing Data and Specimens in Research", "count": 41 }
  ],
  "most_cited_documents": [
    { "document_id": 12, "title": "Use of Existing Data and Specimens in Research", "count": 23 }
  ],

  "top_search_terms": [ { "text": "irb exempt", "count": 17 } ],
  "zero_result_searches": {
    "total": 31,
    "top_terms": [ { "text": "lab notebook retention", "count": 4 } ]
  },

  "top_questions": [ { "text": "do i need irb approval to use an existing dataset?", "count": 6 } ],

  "questions_by_outcome": { "answered": 71, "referred": 15, "out_of_scope": 4, "no_answer": 9, "error": 2 },
  "referrals_by_office": [
    { "office": { "id": 2, "name": "Office of Human Research Ethics", "email": null, "phone": null, "url": null }, "count": 12 }
  ],

  "feedback": { "rated": 40, "helpful": 33, "helpful_share": 0.825 },

  "daily": [
    { "date": "2026-10-13", "logins": 4, "topic_views": 9, "document_views": 15, "searches": 6, "questions": 3 }
  ],
  "daily_questions_by_topic": [
    { "date": "2026-10-13", "topic": { "id": 1, "slug": "human-subjects-research", "name": "Human Subjects Research" }, "count": 2 }
  ]
}
```

What each field measures (the numbers are the measures in product.md):

| field | measure | how it's counted |
|---|---|---|
| `activity.active_users` | 1 | distinct people with any logged activity (a login, view, search or question) in the range |
| `activity.logins` | 1 | sign-ins (`login` events); the closest thing to "visits" |
| `interactions` | 2 | `topic_view`, `document_view` and `search` events, and questions asked |
| `top_topics` | 3 | topics by `topic_view` count |
| `top_documents` | 3 | documents by `document_view` count |
| `most_cited_documents` | 3 | documents by how often an answer cited them (`question_citations.was_cited`) |
| `top_search_terms` | 4 | search text (trimmed, lowercased) by number of searches |
| `zero_result_searches` | 5 | `total`: every search that returned nothing; `top_terms`: its most common text |
| `top_questions` | 6 | question text (trimmed, lowercased, exact match) by times asked |
| `questions_by_outcome` | 7 | questions by `outcome`. Unlike the researcher API, `error` (the LLM failed) is kept separate from `no_answer` |
| `referrals_by_office` | 7 | questions that named an office to contact, by that office |
| `feedback` | 8 | ratings on questions asked in the range. `helpful_share` is `helpful / rated`, rounded to 3 places, or `null` when `rated` is 0 |
| `daily` | 9 | one entry for **every** day in the range, oldest first, zeros included |
| `daily_questions_by_topic` | 9 | questions per topic per day, oldest first; only non-zero entries. `topic` is `null` for questions not asked from a topic |

- Every top-N list has at most 10 items, highest count first; ties are broken by name or text,
  A to Z. An empty range gives zeros, empty lists and `helpful_share: null`, never an error.
- `topic` is a [TopicRef](#topic) and `office` an [Office](#office). A topic, document or office
  deleted since is left out of its list (the events behind it remain in the totals).
- The free-text threshold applies to `top_search_terms`, `zero_result_searches.top_terms` and
  `top_questions`. Signed-out activity can't exist (every endpoint requires sign-in), so each
  event has a user unless the user was later removed; an event without a user counts toward
  totals but never toward a threshold.

### `GET /api/admin/analytics/export.csv`
Measure 10. The same parameters, rules and numbers as `GET /api/admin/analytics`, as a CSV file
(`text/csv; charset=utf-8`) with
`Content-Disposition: attachment; filename="nora-analytics_2026-10-13_to_2026-11-11.csv"`.

The file has one section per measure, in this order, separated by a blank line. Each section
starts with a one-cell title row, then a header row, then its data rows:

| section title | columns |
|---|---|
| `Summary` | `measure`, `value`: from, to, min_distinct_users, active_users, logins, topic_views, document_views, searches, questions, feedback_rated, feedback_helpful, feedback_helpful_share |
| `Top topics` | `topic_slug`, `topic_name`, `views` |
| `Top documents viewed` | `document_id`, `title`, `views` |
| `Most cited documents` | `document_id`, `title`, `citations` |
| `Top search terms` | `term`, `searches` |
| `Zero-result search terms` | `term`, `searches` |
| `Most asked questions` | `question`, `times_asked` |
| `Questions by outcome` | `outcome`, `questions` |
| `Referrals by office` | `office`, `questions` |
| `Daily activity` | `date`, `logins`, `topic_views`, `document_views`, `searches`, `questions` |
| `Daily questions by topic` | `date`, `topic_slug`, `topic_name`, `questions` (`topic_slug` and `topic_name` empty for no topic) |

An empty `helpful_share` is an empty cell. A section with no rows still has its title and header.
A text cell that starts with `=`, `+`, `-`, `@`, a tab or a carriage return is prefixed with `'`
so a spreadsheet shows it as text instead of running it as a formula (search terms and questions
are typed by researchers).

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

Editing topics, offices and tags in the app. Add those endpoints here before building them.
