# UBE-46 — Implement cross cutting auth check for all endpoints

Linear: https://linear.app/uberconcept/issue/UBE-46/implement-cross-cutting-auth-check-for-all-endpoints

## Description

Implement a single test that checks all authenticated endpoints return `Unauthorized` when no
token is provided — implemented as a loop through a list of endpoints (HTTP method + parameters).
Delete the existing per-endpoint tests that perform this same check.

## Current state (from repo survey)

Full endpoint inventory (`Api/Controllers/*.cs`):
- `POST /login` (`LoginController`) — anonymous, no `[Authorize]`.
- `GET /` (`RootController`) — anonymous, no `[Authorize]`.
- `GET /settings`, `PUT /settings` (`SettingsController`) — class-level `[Authorize]`.
- `POST /transactions/file`, `GET /transactions` (`TransactionsController`) — class-level
  `[Authorize]`.

So 4 authenticated endpoints need covering. Existing scattered "no token" tests
(`grep -rn Unauthorized Api.IntegrationTests/`):
- `TransactionsEndpointTests.cs`: `Post_ReturnsUnauthorized_WhenNoTokenIsProvided` (POST
  `/transactions/file`)
- `TransactionsEndpointTests.cs`: `Get_ReturnsUnauthorized_WhenNoTokenIsProvided` (GET
  `/transactions`)
- `SettingsEndpointTests.cs`: `Get_ReturnsUnauthorized_WhenNoTokenIsProvided` (GET `/settings`)

**`PUT /settings` currently has no "no token" test at all** — a real coverage gap the new
cross-cutting test will close as a side effect. No `Unauthorized`-related tests exist at the unit
level (`Api.UnitTests/`), since `[Authorize]` enforcement only happens in the real ASP.NET Core
pipeline — unit tests instantiate controllers directly, bypassing it entirely — so nothing to
change there.

## My calls

- **No request body/content needed for the write endpoints (`PUT /settings`,
  `POST /transactions/file`) to prove `401`.** ASP.NET Core's authentication/authorization
  middleware runs before MVC's model-binding stage, so an unauthenticated request never reaches
  model binding at all — a bare `HttpRequestMessage` with no body still gets `401`, not a
  binding-related `400`. Confirming this empirically against the real running Api before relying on
  it, rather than assuming. Keeps the endpoint list to plain `(HttpMethod, url)` pairs, with no
  content-building/reuse complexity.
- **New file `Api.IntegrationTests/AuthorizationTests.cs`**, using xUnit `[Theory]`/`[MemberData]`
  to drive the endpoint list — this *is* "a loop through a list of endpoints" per the ticket, just
  expressed as a data-driven test rather than a literal `foreach` inside one `[Fact]` (equivalent
  effect: one assertion body, run once per listed endpoint, clear per-endpoint failure reporting).

## Plan

1. `Api.IntegrationTests/AuthorizationTests.cs` (new) — `[Theory]`/`[MemberData]` over
   `(HttpMethod, url)` for all 4 authenticated endpoints; asserts `401` for each with no
   `Authorization` header.
2. Verify empirically (real local run) that a bodyless `PUT /settings` and `POST /transactions/file`
   genuinely return `401`, not `400`, before finalizing step 1's approach.
3. Delete the 3 existing per-endpoint "no token" tests from `TransactionsEndpointTests.cs` and
   `SettingsEndpointTests.cs`.

### Verify
4. `dotnet build`/`dotnet test` (unit + integration, against DynamoDB Local) — confirm the new
   cross-cutting test passes for all 4 endpoints and nothing else regressed.

## Checklist

- [x] `Api.IntegrationTests/AuthorizationTests.cs` — `[Theory]`/`[MemberData]` over 4 protected
      endpoints (build clean)
- [x] Verify bodyless requests return 401 (not 400) for the write endpoints — confirmed for real
      against DynamoDB Local, all 4 theory cases pass
- [x] Delete existing per-endpoint "no token" tests — removed from `SettingsEndpointTests.cs` and
      `TransactionsEndpointTests.cs` (2 there)
- [x] Verify: `dotnet build`/`dotnet test` pass — 54/54 tests (38 unit + 16 integration; net +1
      integration test vs. before: 3 removed, 4 new theory cases added)

## Prompt Log

1. "start worklog in UBE-46"
2. "go ahead" (steps 1-2 — AuthorizationTests.cs + empirical verification)
3. "go ahead" (steps 3-4 — delete old tests + final verify)
