# UBE-80: Getting logged out

Linear: https://linear.app/uberconcept/issue/UBE-80/getting-logged-out
Status: In Progress · Priority: No priority

## Description (from Linear)

The automatic refresh of credentials is not working. The front end should refresh the JWT with an API
call every 5 minutes.

## Current state

**There is no JWT refresh mechanism anywhere in the codebase today - client or server.** The ticket
frames this as "not working" (implying it broke), but a direct repo search turns up nothing: no
refresh endpoint on the Api, no timer/interceptor on the FrontEnd. So this is really "implement it,"
not "fix it" - flagging that clearly since it changes what "done" means here.

- **Api**: `POST /login` (`LoginController.Post`) is the only place a token is issued -
  `IJwtTokenGenerator.GenerateToken(email)` (`Api/Auth/JwtTokenGenerator.cs`), a 60-minute expiry
  (`JwtSettings.ExpiryMinutes`, default 60). `GenerateToken` only needs an email, not a password, so
  it's directly reusable for a refresh endpoint - no new token-generation logic needed.
- **FrontEnd**: `stores/auth.ts`'s `useAuthStore` decodes the JWT's own `exp` claim client-side into
  `expiresAt`; `isAuthenticated` is just `token !== null && expiresAt > Date.now()`. Nothing ever
  calls `setToken()` again after the initial login - once `expiresAt` passes, `isAuthenticated` flips
  to `false` and `router/guard.ts`'s `resolveNavigation()` bounces every route back to `/login` (this
  is "getting logged out" - it's the *intended* behavior of an expiring token with nothing renewing
  it, not a bug in the expiry check itself).
- `App.vue` is the SPA's one always-mounted root component (`NavBar` + `RouterView`) - the natural
  place for an app-lifetime timer, since it persists across every route change including login/logout
  (no full page reload either way).
- Per-service `authHeaders()` helpers (`transactionsService.ts`/`settingsService.ts`/
  `transactionDescriptionsService.ts`) all read `useAuthStore().token` fresh on every call, so once the
  store's token is updated via `setToken()`, every subsequent API call automatically picks up the new
  one - no other wiring needed once the store itself is refreshed.

## Plan

**Api**

1. `Api/Controllers/LoginController.cs` - new `[Authorize] [HttpPost("login/refresh")]` action.
   Reads the caller's email from `ClaimTypes.NameIdentifier` (same pattern as
   `TransactionsController`/`SettingsController`), calls the existing `_tokenGenerator.GenerateToken`,
   returns a `LoginResponse` (reusing the existing record - same shape as `/login`'s response).
   `[Authorize]` on this route is exactly the "is this token still currently valid" check for free -
   JWT bearer validation (`ValidateLifetime = true`) rejects an already-expired token with a 401
   before the action even runs, so refreshing only works *ahead* of expiry, not after (matches the
   ticket's "every 5 minutes" cadence against a 60-minute token - 12x margin, so this is only a
   real problem if the app is left completely closed/unloaded for over an hour).
2. `Api.IntegrationTests/AuthorizationTests.cs` - add `[HttpMethod.Post, "/login/refresh"]` to
   `ProtectedEndpoints()` (required per the repo's own cross-cutting-401 convention).
3. `Api.IntegrationTests/LoginEndpointTests.cs` - new cases: a valid token gets a 200 with a new,
   different token string; no token gets a 401 (covered generically by (2) too, but worth an explicit
   assertion here alongside the "it actually works" case).

**FrontEnd**

4. `FrontEnd/src/services/authService.ts` - new `refreshToken(token: string): Promise<string>`,
   `POST /login/refresh` with `Authorization: Bearer <token>`, mirroring `login()`'s shape/error
   handling.
5. New `FrontEnd/src/composables/useTokenRefresh.ts` - wires a `setInterval` (5 minutes) via
   `onMounted`/`onUnmounted`; each tick, if `authStore.isAuthenticated`, calls `refreshToken` and
   `authStore.setToken(...)` on success. A failed refresh (network blip, etc.) is swallowed silently -
   no logout-on-failure, no retry; the existing expiry-based `isAuthenticated` check is what naturally
   logs the user out if refreshing keeps failing, same as today's behavior. Extracted out of `App.vue`
   specifically so the interval logic itself is unit-testable (vitest fake timers) rather than living
   untested in a view.
6. `App.vue` - call `useTokenRefresh()`.

**Tests**

7. `FrontEnd.UnitTests/services/authService.test.ts` - add `refreshToken` cases, mirroring the
   existing `login` ones.
8. New `FrontEnd.UnitTests/composables/useTokenRefresh.test.ts` - fake timers + a mocked Pinia auth
   store + mocked `fetch`: confirms a tick while authenticated calls refresh and updates the store;
   confirms a tick while *not* authenticated makes no call; confirms a failed refresh doesn't throw/
   doesn't clear the existing token.

**Verification**

9. `dotnet test`; `npm run build`/`lint`; `FrontEnd.UnitTests`; manual local check (shorten the
   interval temporarily, or just watch the console/Network tab, to see a real refresh call go out and
   the stored token change) - not adding Playwright coverage for this, a real 5-minute wait isn't a
   reasonable thing to assert on in a functional test suite.

## Checklist

- [ ] `LoginController.cs` - `POST /login/refresh`
- [ ] `AuthorizationTests.cs` - add to `ProtectedEndpoints()`
- [ ] `LoginEndpointTests.cs` - new refresh cases
- [ ] `authService.ts` - `refreshToken()`
- [ ] `useTokenRefresh.ts` - interval composable
- [ ] `App.vue` - wire it in
- [ ] `authService.test.ts` - new cases
- [ ] `useTokenRefresh.test.ts` - new test file
- [ ] Build/lint/unit/integration verification + manual local check

## Prompt log

- "is there currently code to refresh the jwt for authentication?"
- "start a worklog for UBE-80"
