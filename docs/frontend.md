# Frontend

**Status:** Current as of 2026-11-12. Shell, sign-in, the admin Overview mockup, the admin
content pages (Policy Library, Content Management, document editor) and the admin FAQ pages are
built. Every researcher page uses the real API, including the document page, the subtopic tag
page, the topic page's tag filter (workflow D, F3) and the FAQ page (workflow E, F8).

React + TypeScript + Vite, with React Router v7 in declarative mode (`<BrowserRouter>` +
`<Routes>`). API calls go through `src/api/client.ts` (see [api.md](api.md)).

## Layout

```
src/main.tsx        BrowserRouter, loads theme.css
src/App.tsx         every route
src/theme.css       UNC colors and spacing as CSS variables, base element styles
src/layout/         AppLayout (header + sidebar + page), AppHeader, SideNav, navItems.ts, NotFound
src/auth/           AuthProvider/useAuth, RequireAuth, RequireRole, authApi.ts (the auth calls)
src/pages/SignIn*   sign-in page
src/pages/admin/    admin pages
src/pages/researcher/  researcher pages
src/components/     shared components for the researcher pages
```

## Routes

| Path | Page | Area |
|---|---|---|
| `/signin` | `pages/SignIn` | standalone, no nav |
| `/` | `pages/researcher/HomePage` | researcher |
| `/browse` | `pages/researcher/BrowsePage` | researcher |
| `/browse/:slug` | `pages/researcher/TopicPage` | researcher |
| `/search` | `pages/researcher/SearchPage` | researcher |
| `/ask` | `pages/researcher/AskPage` | researcher |
| `/saved` | `pages/researcher/SavedPage` | researcher |
| `/documents/:id` | `pages/researcher/DocumentPage` | researcher |
| `/tags/:slug` | `pages/researcher/TagPage` | researcher |
| `/faqs` | `pages/researcher/FaqPage` | researcher |
| `/admin` | `pages/admin/AdminOverview` | admin |
| `/admin/library` | `pages/admin/PolicyLibraryPage` | admin |
| `/admin/content` | `pages/admin/ContentManagementPage` | admin |
| `/admin/documents/:id` | `pages/admin/DocumentEditorPage` | admin |
| `/admin/faqs` | `pages/admin/FaqListPage` | admin |
| `/admin/faqs/new`, `/admin/faqs/:id` | `pages/admin/FaqEditorPage` | admin |
| anything else | `layout/NotFound` | inside the area it falls under |

Researcher and admin pages render inside `AppLayout`, which takes the nav items for its area.
Researcher pages also sit under `SavedProvider` (see Saved items below).
Every route except `/signin` sits under `RequireAuth`, and `/admin` also under
`RequireRole role="admin"`.

## Auth

- `useAuth()` gives `user`, `loading`, `signIn(onyen)` and `signOut()`. `AuthProvider` calls
  `GET /api/me` once on load; a 401 means signed out.
- Signed-out users are sent to `/signin` with the page they wanted in router state, and go back
  there after signing in. Otherwise admins land on `/admin` and researchers on `/`. After an
  explicit sign-out (`signedOut` in `useAuth()`), the page isn't remembered, so the next person
  lands on their own home page instead of the previous user's page.
- `RequireRole` only hides UI. The backend's `require_role()` is what enforces access.
- Sign-in always uses the real backend. Run the full stack (`docker compose up`) and sign in as
  `researcher1` or `admin1`. The temporary frontend-only fake auth was removed on 2026-10-12.

## Admin Overview

`src/pages/admin/AdminOverview.tsx` is the admin dashboard (F11), on
`GET /api/admin/analytics` ([api.md](api.md#admin-analytics)). It shows every measure in
[product.md](product.md#admin-dashboard-must-have): tiles for users, interactions, unanswered
questions and the helpful share; daily activity (one measure at a time, so there's one axis);
questions by topic, with first- and second-half counts in its table to show which topics are
growing; outcomes, referrals by office and ratings; and the most viewed, cited, searched,
zero-result and asked lists. The range is in the URL (`/admin?from=&to=`); without one the
API's default, the last 30 days, is shown. "Download CSV" links `export.csv` for the same range.
Date helpers are in `dateRange.ts`. Free-text lists say when they're empty because of the
2-person threshold (NF6). The charts in `src/pages/admin/charts/` are plain SVG/CSS (no
chart library). Tests get a fixed-width `ResizeObserver` from `src/test/setup.ts`, since jsdom
has none. Their series colors are `--chart-series-1`/`-2` in `charts.css`; they passed a
color-blind and contrast check, which Carolina Blue on its own doesn't.

## Admin content pages

Workflow D's admin side (F12, NF7), on the endpoints in
[api.md](api.md#admin-content-management). Data goes through `pages/admin/adminApi.ts`.

- **Policy Library** (`/admin/library`): every document in any status, with keyword search and
  status and topic filters, 20 per page. The filters and page are in the URL.
- **Content Management** (`/admin/content`): add a document by its Repository link (it lands as
  a draft and opens in the editor; a duplicate's error links to the existing document), and the
  drafts waiting for review.
- **Document editor** (`/admin/documents/:id`): type, owning office, topics, up to 5 tags and the
  official-source flag, saved together with one `PATCH`. Publish, archive and restore buttons
  are disabled while there are unsaved changes, and Publish also until the saved document has an
  office and a topic. Permanent delete appears only for archived documents and asks for
  confirmation, naming the document, before it sends `confirm=true`. The Repository text is shown
  (open by default for drafts) so it can be checked before publishing.
- The API's `active` status is shown as "Published" (`adminFormat.ts`).
- Publishing or editing a document doesn't update its Ask chunks yet; that's the open
  "re-run ingestion" item in [roadmap.md](roadmap.md).

## Admin FAQ pages

Workflow E's admin side (F8, NF7), on the endpoints in [api.md](api.md#admin-faqs), through
`pages/admin/adminApi.ts`. FAQs have their own "FAQs" item in the admin sidebar.

- **FAQ list** (`/admin/faqs`): every FAQ in any status, with status and topic filters in the
  URL. There are few FAQs, so it isn't paged. A missing topic shows as "None", since publishing
  needs one.
- **FAQ editor** (`/admin/faqs/new` and `/admin/faqs/:id`): question, answer, topic, source
  policies and display order, saved together (`POST` for a new draft, then `PATCH`). The answer
  has a live preview with the same renderer researchers see. Source policies are found by
  searching every document (`GET /api/admin/documents?q=`); results that aren't published say
  researchers won't see them. The search box isn't a nested form, so Enter in it searches
  instead of saving the FAQ. Publish, archive, restore and the confirmed permanent delete work
  like the document editor's, and Publish is disabled until the saved FAQ has a topic.
- `StatusBadge` shows both document and FAQ statuses; a published FAQ looks like a published
  (`active`) document.

## Researcher pages

The pages in `src/pages/researcher/` follow the client mockup. The home page has equal-weight
Browse, Search and Ask cards that link to `/browse`, `/search` and `/ask`, plus an inline ask
panel, the topic grid and a right rail. Search keeps its query in the URL (`/search?q=`).

- **Data:** pages get data only through `researcherApi.ts`, which has one function per endpoint in
  [api.md](api.md). All of them call the real API, including `ask()` (`POST /api/ask`).
- **Answers:** `AnswerCard` renders every Ask outcome, the confidence indicator, the offices to
  contact (`contacts`), any `links`, and the disclaimer when the API sends one. All of that
  wording comes from the backend; the frontend has no copy. The LLM writes a little Markdown (paragraphs, `- ` lists, `**bold**`) and cites as
  `[1]` or `【1】`; `AnswerText` turns exactly those into React elements, so model output is never
  inserted as HTML. Answers take several seconds, and the loading text says so.
- **Ask:** `components/AnswerCard.tsx` renders every `AskResponse` outcome: an answer with `[n]`
  citations, sources only, a referral to RCS, and `out_of_scope` (not about research; a
  neutral card with the University Policy Office and a link to every UNC policy).
- **Feedback (F7):** `AnswerFeedback` puts Helpful / Not helpful under every fresh answer
  (`PUT /api/questions/{id}/feedback`). Clicking the selected button again removes the rating
  (`DELETE`). Not helpful opens an optional comment box. Saved answers show the buttons too, starting
  from the user's rating (`question.feedback`). Each change is passed to `useSaved().setRating`,
  because the saved list is loaded once per session: rating an answer on the Ask page or the
  Saved page keeps the Saved page current.
- **Saved items (F9):** `SavedProvider` (`src/saved/`) loads `GET /api/saved` once and shares it
  through `useSaved()`, so every `SaveButton` and the Saved page agree without refetching.
  `SaveButton` is a toggle (`aria-pressed`) on each answer and on every `DocumentResultCard`; on
  the Saved page, turning it off removes the item. Saved answers render with the same
  `AnswerCard` via `savedAnswer()` in `components/answerContent.ts`. They have no confidence
  score; their contacts, disclaimer and links come from the saved response. The home page's right rail lists the three newest
  saved items.
- **Citation anchors:** each `AnswerCard` prefixes its `[n]` anchors with `useId()`, because the
  Saved page shows several answers at once.
- **Styles:** `components/components.css` defines `--rp-*` tokens on `.researcher`, mapped onto
  `theme.css`, and uses the theme's `.button` and `.badge`.
- **Documents and subtopics (F3):** a `DocumentResultCard`'s title opens `/documents/:id`, and a
  separate "Repository" link opens the source. `DocumentPage` shows the summary, owning office,
  topics, tags (`TagList`, linking to `/tags/:slug`) and related policies, plus a button to the
  Repository. It deliberately doesn't show `content_text`: the Repository has the official, current
  text (F12). `TagPage` lists every policy with one tag across topics. There's no single-tag
  endpoint, so it finds the tag in `GET /api/tags`.
- **FAQs (F8):** `FaqPage` (`/faqs`) loads every published FAQ once and groups them by topic,
  in the topics' display order, with a one-at-a-time topic filter in the URL (`/faqs?topic=`).
  An FAQ whose topic was removed goes under "Other". Each FAQ is a `FaqItem` (`<details>`): the
  question opens to the answer and the policies it's based on, linking to `/documents/:id`.
  Topic pages show their first three FAQs, in the admins' order, and link to the rest; the
  section is left out when there are none or they fail to load.
- **Markdown:** `components/MarkdownText` renders the small Markdown that Ask answers and FAQ
  answers use (paragraphs, `- ` lists, `**bold**`) as React elements, never as HTML.
  `AnswerCard` passes it a `renderCitation` callback for its `[n]` links; FAQs pass none.
- **Topic tag filter:** `TopicPage` shows the topic's tags as one-at-a-time filter chips, kept in
  the URL (`/browse/:slug?tag=`). The topic and its documents load separately, so changing the
  filter doesn't call `GET /api/topics/{slug}` again, which would log another topic view. Topic
  and tag pages ask for 100 documents, the API's maximum; the largest topic has 74.
- Topic icons are picked by slug in `components/topicIcon.ts`, since the API has no icon field.

## Navigation

The sidebar items are in `src/layout/navItems.ts`. An item without `to` has no page yet and shows
disabled with a "Soon" tag. When you add a page: add its route in `App.tsx`, then give its nav
item a `to`. Set `end: true` only on items that shouldn't stay highlighted on the pages below them
(Home, Overview).

## Testing

`npm test` runs Vitest with React Testing Library in jsdom (`npm run test:watch` while
developing, `npm run coverage` for a report). CI runs it on every PR.

- Put a test next to the code it tests: `AnswerCard.tsx` → `AnswerCard.test.tsx`.
- Test what a researcher sees and does: find elements by role, label or text
  (`getByRole('button', { name: 'Ask' })`), click and type with `userEvent`, and assert on the
  result. Avoid class names and component internals.
- Mock the API functions a component calls (`vi.mock('../pages/researcher/researcherApi')`), or
  stub `fetch` when testing the API functions themselves.
- Each workflow adds tests for the screens it builds. There's no coverage threshold yet:
  existing pages were written without tests, and a 100% gate would block everyone before the
  MVP. Add one once the main screens are covered.

## Styling

- Use the variables in `theme.css` (`--color-navy`, `--color-accent`, `--space-4`, ...) rather
  than hard-coded values.
- Carolina Blue (`#4B9CD3`) is too light for text on white. Use navy for text and links, and
  Carolina Blue for accents such as borders and highlights.
- Plain CSS files next to the component that uses them (for example `layout/layout.css`).
- The layout must work down to phone width. The shell switches to a mobile layout below 48rem.
