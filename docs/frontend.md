# Frontend

**Status:** Current as of 2026-11-12. Shell, sign-in and the admin Overview mockup are built.
Every researcher page uses the real API, including the document page, the subtopic tag page and
the topic page's tag filter (workflow D, F3).

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
| `/admin` | `pages/admin/AdminOverview` | admin |
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

`src/pages/admin/AdminOverview.tsx` is a mockup. All of its numbers are in `sampleData.ts`, and the
page shows a "Sample data" badge. The charts in `src/pages/admin/charts/` are plain SVG/CSS (no
chart library). Their series colors are `--chart-series-1`/`-2` in `charts.css`; they passed a
color-blind and contrast check, which Carolina Blue on its own doesn't.

## Researcher pages

The pages in `src/pages/researcher/` follow the client mockup. The home page has equal-weight
Browse, Search and Ask cards that link to `/browse`, `/search` and `/ask`, plus an inline ask
panel, the topic grid and a right rail. Search keeps its query in the URL (`/search?q=`).

- **Data:** pages get data only through `researcherApi.ts`, which has one function per endpoint in
  [api.md](api.md). All of them call the real API, including `ask()` (`POST /api/ask`).
- **Answers:** `AnswerCard` renders every Ask outcome, the confidence indicator and the
  disclaimer. The LLM writes a little Markdown (paragraphs, `- ` lists, `**bold**`) and cites as
  `[1]` or `【1】`; `AnswerText` turns exactly those into React elements, so model output is never
  inserted as HTML. Answers take several seconds, and the loading text says so.
- **Ask:** `components/AnswerCard.tsx` renders every `AskResponse` outcome (answer with `[n]`
  citations, sources only, referral) and always shows the disclaimer.
- **Feedback (F7):** `AnswerFeedback` puts Helpful / Not helpful under every fresh answer
  (`PUT /api/questions/{id}/feedback`). Clicking the selected button again removes the rating
  (`DELETE`). Not helpful opens an optional comment box. The API has no way to read a rating
  back, so the buttons start unselected each time an answer is shown, and saved answers don't
  show them.
- **Saved items (F9):** `SavedProvider` (`src/saved/`) loads `GET /api/saved` once and shares it
  through `useSaved()`, so every `SaveButton` and the Saved page agree without refetching.
  `SaveButton` is a toggle (`aria-pressed`) on each answer and on every `DocumentResultCard`; on
  the Saved page, turning it off removes the item. Saved answers render with the same
  `AnswerCard` via `savedAnswer()` in `components/answerContent.ts`. They have no confidence
  score, and their disclaimer is a copy of the backend's `DISCLAIMER`, since the saved response
  doesn't include it: change both together. The home page's right rail lists the three newest
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
