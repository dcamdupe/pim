# UBE-38 — Add auth check into front end and API

Linear: https://linear.app/uberconcept/issue/UBE-38/add-auth-check-into-front-end-and-api

## Description

- Store the JWT with an expiry time in local storage
- For all front end routes other than login, check whether this exists
  - create a helper function for this
  - If this doesn't exist, redirect to login page

## Context (from reading the current code)

- `FrontEnd/src/stores/auth.ts` currently holds the token only in an in-memory Pinia `ref` —
  nothing is persisted, and there's no expiry tracking.
- `FrontEnd/src/router/index.ts` has no navigation guards at all — `/dashboard` is reachable
  directly with no token.
- On the API side, JWT bearer auth is already fully wired up in `Api/IoC/ServiceMapping.cs`
  (`AddAuthentication`/`AddJwtBearer`/`AddAuthorization`, `UseAuthentication`/`UseAuthorization`
  in `Program.cs`) from an earlier ticket. The only two controllers are `LoginController`
  (must stay anonymous) and `RootController` (health check, must stay anonymous) — there's no
  protected endpoint yet to attach `[Authorize]` to, since `DashboardView.vue` is still mock data
  not wired to the API. So unless this is meant to include adding a first protected endpoint,
  the API side of this ticket looks already satisfied by that earlier work.

## Plan

1. **`FrontEnd/src/stores/auth.ts`** — persist `{ token, expiresAt }` to `localStorage` on
   `setToken` (decode the JWT's standard `exp` claim rather than hardcoding a duration, so it
   stays correct if `JwtSettings.ExpiryMinutes` changes), restore state from `localStorage` on
   store init, and add a `isAuthenticated` helper (true only if a token exists and `expiresAt` is
   in the future) plus a `clearToken`/`logout` to remove it.
2. **`FrontEnd/src/router/index.ts`** — add a `router.beforeEach` guard: any route other than
   `login` checks `authStore.isAuthenticated`; if false, redirect to `login`.
3. **`FrontEnd.UnitTests/`** — unit tests for the store (persists/restores, expiry boundary) and
   for the router guard (redirects when unauthenticated, allows through when authenticated).
4. **API** — confirm-only: no `[Authorize]` changes, since there's no protected endpoint yet
   (see Context above). Flag if that assumption is wrong.
5. **`FunctionalTests/`** — extend/add a Playwright scenario: visiting `/dashboard` unauthenticated
   redirects to `/login`.
6. Verify: `npm run test` (`FrontEnd.UnitTests`), `npm run build`/`npm run lint` (`FrontEnd`),
   Playwright functional test, manual check via `scripts/run_local.sh`.

## Checklist

- [x] `stores/auth.ts` — persist token + expiry to `localStorage`, restore on init
- [x] `stores/auth.ts` — `isAuthenticated` helper
- [x] `router/index.ts` — `beforeEach` guard redirecting to `login`
- [x] Unit tests — store persistence/expiry
- [x] Unit tests — router guard
- [x] Confirm API side needs no change (or scope it in, if it does) — confirmed, no protected endpoint exists yet
- [x] Functional test — unauthenticated `/dashboard` redirects to `/login`
- [x] Verify: unit tests, build/lint, functional test, real local run

## Notes

- **Discovered during implementation:** `FrontEnd.UnitTests` has its own `node_modules`, separate
  from `FrontEnd/node_modules` (per `CLAUDE.md`). The first test that imported a package also
  present in both (`pinia`) hit a dual-package-instance bug — `useAuthStore()` resolved `pinia`
  via `FrontEnd/`'s copy (since the source file lives there) while the test's own `setActivePinia`
  call used `FrontEnd.UnitTests/`'s copy, so Pinia's module-scope "active instance" never matched.
  Fixed with `resolve.dedupe: ['vue', 'pinia', 'vue-router']` in
  `FrontEnd.UnitTests/vitest.config.ts`. Also added `pinia`/`vue-router` as devDependencies there
  (matching `FrontEnd/package.json`'s versions) since neither was needed by a test before now.

## Prompt Log

1. "start worklog for UBE-38"
2. "go ahead"
3. "just run_site.sh" (in response to manually checking Mongo/port state with lsof/pgrep)
4. "wake up"
5. "just rely on run_website.sh this is what it is there for" (in response to a curl-based readiness poll)
