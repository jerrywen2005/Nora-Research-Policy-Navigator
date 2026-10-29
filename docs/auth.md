# Authentication and roles

**Status:** The backend mock provider is **Current** (built 2026-10-12), and so is the
frontend sign-in. The Shibboleth provider is *Proposed*. UNC SSO (Connect Carolina / Onyen) access
was requested from David Cowig (Jerry, 2026-10-12) and from ITS (Andy and Anton, 2026-10-21). A
reply to the auth request has come in; its details still need to be recorded here. SSO is now our
only infrastructure dependency: the client's team handles hosting (see
[deployment.md](deployment.md)).

Code: backend `app/auth/` (`get_current_user`, `require_role`, `record_login`), `app/api/auth.py`
(endpoints) and `app/seed/users.py` (`researcher1`, `admin1`); frontend `src/auth/`.

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
- `POST /api/auth/mock-login {onyen}` sets a signed, HTTP-only session cookie named
  `nora_session`. It's signed with `SESSION_SECRET`, lasts 8 hours, is `SameSite=Lax`, and is
  HTTPS-only in production. The cookie stores only the user id; the user and role are re-read
  from the database on every request, so disabling a user or changing their role takes effect
  immediately.
- Onyens are trimmed and lowercased, and may contain only `[a-z0-9._-]` (max 64).
- Unknown Onyens are created as `researcher`.
- The app refuses to start with `ENVIRONMENT=production` if `AUTH_PROVIDER=mock` or if
  `SESSION_SECRET` is still the development default.

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

**Rule (decided 2026-10-12):** there is one admin list, and admins (Jeanne, to start) maintain it
in the app. Everyone not on it is a researcher.

- New users default to `researcher`.
- **The list is the database:** the users whose `role = 'admin'`. There's no separate admin table.
- **Editing it** *(Proposed, not built)*: the Users & Roles admin page lists admins and lets an
  admin add one by Onyen or remove one.
  - Adding an Onyen that has never signed in creates their `users` row as an admin ahead of time,
    so their first sign-in already shows the admin view.
  - Removing an admin sets them back to `researcher`; their account stays.
  - The last remaining admin can't be removed (409), so the app can't be locked out.
- **Bootstrap** *(Proposed, not built)*: an `ADMIN_ONYENS` setting (comma-separated) makes those
  Onyens admins when they sign in. It's only for getting the first admin (Jeanne) onto a fresh
  deployment; after that, the list is managed in the app. Locally, the seed script's `admin1`
  plays this role.
- Admin-only routes live under `/api/admin/*` and use
  `Depends(require_role(Role.ADMIN))`. Disabled users (`is_active = false`) get 401.
- The frontend hides admin UI for researchers, but the backend check is what enforces access.
