# UBE-13 — Add functional tests project for api

Linear: https://linear.app/uberconcept/issue/UBE-13/add-functional-tests-project-for-api

## Description

- New project called `Api.IntegrationTests`.
- Tests should cover existing endpoints.
- Update `CLAUDE.md` for the project to reference the new project.
- Add a requirement that all endpoints should be covered by functional tests.

Existing endpoints to cover (as of this worklog):
- `GET /` (`RootController`) — pings MongoDB, returns `200` + version or `503`.
- `POST /login` (`LoginController`) — validates credentials, returns `200` + JWT or `400`.

## Plan

1. Create `Api.IntegrationTests` (xUnit), referencing `Api`, using `Microsoft.AspNetCore.Mvc.Testing`'s `WebApplicationFactory<Program>` to host the API in-process.
2. Add it to `Pim.sln`.
3. Handle the Mongo dependency for functional tests — likely point at the same local MongoDB (matching `scripts/setup_local.sh`) rather than mocking it, since these are functional/integration tests.
4. Write tests covering both existing endpoints:
   - `GET /` — 200 with version when Mongo is reachable.
   - `POST /login` — 200 + token for the seeded test user, 400 for wrong password/unknown login.
5. Update `CLAUDE.md`: reference `Api.IntegrationTests`, and add the requirement that all endpoints must be covered by functional tests.
6. Verify `dotnet test` runs (existing unit tests + new integration tests) against local Mongo.

## Checklist

- [x] Create `Api.IntegrationTests` project (xUnit + `WebApplicationFactory`)
- [x] Add to `Pim.sln`
- [x] Cover `GET /`
- [x] Cover `POST /login` (success + failure, plus unknown login)
- [x] Update `CLAUDE.md` (reference new project + all-endpoints-covered requirement)
- [x] Verify `dotnet test` passes

## Notes

- `Api/Program.cs`: added `public partial class Program;` at the bottom so `WebApplicationFactory<Program>` can reference it from the test assembly (top-level statements otherwise generate an internal `Program`).
- `Api.IntegrationTests/ApiWebApplicationFactory.cs`: thin `WebApplicationFactory<Program>` subclass, no overrides — runs against the real local MongoDB (`Api/appsettings.json` defaults), no mocking, since these are functional tests.
- `RootEndpointTests.cs`: `GET /` returns `200` with a non-empty version.
- `LoginEndpointTests.cs`: seeds a uniquely-named user directly via the factory's own `IMongoDatabase` (`IAsyncLifetime.InitializeAsync`) and deletes it in `DisposeAsync`, so tests are self-contained and don't depend on `scripts/setup_local.sh` having been run. Covers success (200 + token), wrong password (400), and unknown login (400). Reused the real `RootResponse`/`LoginResponse` records from the controllers instead of duplicating DTOs.
- Verified 7/7 tests pass locally (3 unit + 4 integration) against real Mongo, and confirmed no leftover test users in the `User` collection after the run.
- **CI deviation:** initially wired `Api.IntegrationTests` into `.github/workflows/dotnet.yml` (Mongo service container + `dotnet test Pim.sln`), but per the user's instruction this was reverted — CI's `test` job now runs only `Api.UnitTests` (`dotnet test Api.UnitTests/Pim.Api.UnitTests.csproj`). The `build` job still builds the whole solution (`Pim.sln`), so `Api.IntegrationTests` is still compile-checked in CI, just not executed there. Integration tests are a local/manual verification step for now.

## Prompt Log

1. "create worklog for UBE-13"
2. "start to implement the checklist"
3. "Do not include this in the github CI"
