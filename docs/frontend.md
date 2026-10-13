# Frontend

**Status:** Current as of 2026-10-13. Shell, sign-in and the admin Overview mockup are built.
Researcher Browse, Topic and Search pages use the real API; Ask still uses fake data, and
`DocumentPage` is still a placeholder.

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
| `/documents/:id` | `pages/researcher/DocumentPage` | researcher |
| `/admin` | `pages/admin/AdminOverview` | admin |
| anything else | `layout/NotFound` | inside the area it falls under |

Researcher and admin pages render inside `AppLayout`, which takes the nav items for its area.
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
  [api.md](api.md). `getTopics`, `getTopic` and `getDocuments` call the real API. `ask()` still
  returns `fakeData.ts` until `POST /api/ask` exists; then replace its body with the `apiPost`
  call in its comment and delete `fakeData.ts`.
- **Ask:** `components/AnswerCard.tsx` renders every `AskResponse` outcome (answer with `[n]`
  citations, sources only, referral) and always shows the disclaimer.
- **Styles:** `components/components.css` defines `--rp-*` tokens on `.researcher`, mapped onto
  `theme.css`, and uses the theme's `.button` and `.badge`.
- Topic icons are picked by slug in `components/topicIcon.ts`, since the API has no icon field.

## Navigation

The sidebar items are in `src/layout/navItems.ts`. An item without `to` has no page yet and shows
disabled with a "Soon" tag. When you add a page: add its route in `App.tsx`, then give its nav
item a `to`. Set `end: true` only on items that shouldn't stay highlighted on the pages below them
(Home, Overview).

## Styling

- Use the variables in `theme.css` (`--color-navy`, `--color-accent`, `--space-4`, ...) rather
  than hard-coded values.
- Carolina Blue (`#4B9CD3`) is too light for text on white. Use navy for text and links, and
  Carolina Blue for accents such as borders and highlights.
- Plain CSS files next to the component that uses them (for example `layout/layout.css`).
- The layout must work down to phone width. The shell switches to a mobile layout below 48rem.
