# Authentication and roles

**Status:** Proposed 2026-10-11. Frontend built 2026-10-12 (running on fake auth); backend not yet built. UNC SSO access has been requested but not granted
(contact: David Cowig).

## Principle

Authentication (who you are) is separate from authorization (what you may do).
- An **auth provider** produces an identity: the Onyen, plus a name and email when available.
- The backend then upserts the `users` row and reads `users.role` from our own database. The
  identity provider never decides roles.

## Providers

The provider is chosen by the `AUTH_PROVIDER` env var. Only the provider module knows which one is
active. Routes depend on `get_current_user()` and `require_role(...)`, and never read cookies or
headers themselves.

### `mock` (now: local, CI and demos)

- The frontend sign-in page (`/signin`) takes an Onyen and has "Researcher demo" and "Admin demo"
  buttons for the seeded accounts. It uses Nora's own UNC-colored theme, is labeled "Demo sign-in.
  UNC SSO will replace this.", and deliberately doesn't imitate UNC's real Onyen/SSO login page.
- Until the backend endpoints exist, `VITE_FAKE_AUTH=true` makes the frontend fake them
  (`frontend/src/auth/fakeAuth.ts`, in memory, `researcher1` and `admin1` only). Delete it once the
  real endpoints are on dev.
- `POST /api/auth/mock-login {onyen}` sets a signed, HTTP-only session cookie (secret from
  `SESSION_SECRET`).
- Unknown Onyens are created as `researcher`.
- The app refuses to start with `AUTH_PROVIDER=mock` when `ENVIRONMENT=production`.

### `shibboleth` (later)

- Expected pattern: a Shibboleth service provider or proxy in front of the app authenticates
  against sso.unc.edu and passes attributes in request headers (for example the eppn, which holds
  the Onyen, plus display name and email). The exact header names are still to be confirmed.
- The backend trusts those headers only from the proxy. The headers must never be reachable
  directly from the internet.
- Logout goes to the SSO logout URL.

## Endpoints

- `GET /api/me`: the current user and their role, or 401.
- `POST /api/auth/mock-login`: mock provider only.
- `POST /api/auth/logout`

## Admins

- New users default to `researcher`.
- Admins are granted by the seed script or an `ADMIN_ONYENS` env list at startup. Later, existing
  admins can grant it from the Users & Roles admin page.
- Admin-only routes live under `/api/admin/*` and use `require_role("admin")`.
- The frontend hides admin UI for researchers, but the backend check is what enforces access.
