# Frontend

**Status:** Current as of 2026-10-12. The app shell is built; pages are placeholders.

React + TypeScript + Vite, with React Router v7 in declarative mode (`<BrowserRouter>` +
`<Routes>`). API calls go through `src/api/client.ts` (see [api.md](api.md)).

## Layout

```
src/main.tsx        BrowserRouter, loads theme.css
src/App.tsx         every route
src/theme.css       UNC colors and spacing as CSS variables, base element styles
src/layout/         AppLayout (header + sidebar + page), AppHeader, SideNav, navItems.ts, NotFound
src/auth/           sign-in state and route guards (not built yet)
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
Admin routes aren't guarded yet; that comes with sign-in.

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
