# Authentication and roles

**Status:** The mock provider is **Current** (built 2026-10-12). The Shibboleth provider is
*Proposed*. UNC SSO access was requested by email to David Cowig; there's no reply yet.

Code: `app/auth/` (`get_current_user`, `require_role`, `record_login`), `app/api/auth.py`
(endpoints), and `app/seed/users.py` (`researcher1`, `admin1`).

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

- The frontend sign-in page is styled after UNC's Onyen login and takes an Onyen.
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

- New users default to `researcher`.
- For now, admins come from the seed script. Later, existing admins can grant the role from the
  Users & Roles admin page. An `ADMIN_ONYENS` env list for bootstrapping production admins is a
  possible addition, not yet built.
- Admin-only routes live under `/api/admin/*` and use
  `Depends(require_role(Role.ADMIN))`. Disabled users (`is_active = false`) get 401.
- The frontend hides admin UI for researchers, but the backend check is what enforces access.
