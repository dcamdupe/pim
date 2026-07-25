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

- [ ] Create `Api.IntegrationTests` project (xUnit + `WebApplicationFactory`)
- [ ] Add to `Pim.sln`
- [ ] Cover `GET /`
- [ ] Cover `POST /login` (success + failure)
- [ ] Update `CLAUDE.md` (reference new project + all-endpoints-covered requirement)
- [ ] Verify `dotnet test` passes

## Prompt Log

1. "create worklog for UBE-13"
