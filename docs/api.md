# API contract

**Status:** Agreed shapes for the Oct 14 demo (2026-10-11). The **Auth** endpoints are
implemented (2026-10-12), and so are **Topics** and **Documents** (2026-10-13); the rest are not
yet.

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
  "document_count": 4
}
```

#### TopicDetail
A Topic plus the office that handles referrals for it:
```json
{
  "id": 1,
  "slug": "human-subjects-research",
  "name": "Human Subjects Research",
  "description": "IRB review, consent, and protections for research participants.",
  "document_count": 4,
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

## Documents

### `GET /api/documents`
Lists active documents. Used for both browse (filter by topic) and search (keyword).

Query parameters, all optional:
| name | meaning |
|---|---|
| `topic` | topic slug; only documents in that topic |
| `q` | keyword search over title, summary and content (Postgres full-text search) |
| `limit` | default 20, max 100 |
| `offset` | default 0 |

With `q`, results are ordered by relevance (title matches rank above summary matches, which rank
above body matches); without it, by title. `q` uses web-search syntax: every word must match
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
  "is_authoritative": true,
  "last_reviewed_at": "2026-08-01"
}
```
`doc_type` is one of `policy`, `standard`, `procedure`, `sop`, `guidance`, `faq`, `webpage`, `job_aid`, `other`.
`citation`, `source_url`, `summary`, `office` and `last_reviewed_at` may be `null`.

#### DocumentDetail
A DocumentSummary plus `"content_text": "full text..."`.

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

Feedback, saved items, FAQs and the other `/api/admin/*` endpoints. The admin page is a mockup with fake
data for Oct 14. Add those endpoints here before building them.
