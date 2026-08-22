# UBE-17: Add API.Integration tests into github CI

## Linear issue

[UBE-17](https://linear.app/uberconcept/issue/UBE-17/add-apiintegration-tests-into-github-ci) — Add API.Integration tests into github CI

> Add a new action: Test Integration.
>
> This would need to ensure that the local setup includes a emulator for dynamoDB and installing local data.
>
> This might require a pre-built container.

## Note on prior guidance

When `Api.IntegrationTests` was first added (UBE-13), the explicit instruction was **not** to wire
it into CI - keep CI scoped to build + unit tests only. UBE-17 reverses that; confirmed with the
user before starting that this is intentional (memory updated accordingly).

## Description

Add a new CI job that runs `Api.IntegrationTests` (DynamoDB Local-backed) in GitHub Actions.

Investigated how the integration tests actually get their data:
- `ApiWebApplicationFactory` always forces the `Local` ASP.NET Core environment, which reads
  `Api/appsettings.Local.json` → `Aws:ServiceUrl = http://localhost:8000`, `Aws:Region = us-east-1`.
- The Api itself never auto-creates DynamoDB tables - `scripts/setup_local.sh` does that for local
  dev (`User`, `TransactionMonth`, `TransactionDescriptions`, `DescriptionMapping`, all with a
  simple `id` (S) hash key, `PAY_PER_REQUEST` billing).
- Individual test classes are self-contained: they create/delete their own users directly via
  `IRepository<User>` with randomised emails (see `LoginEndpointTests`) - there's no dependency on
  the seeded `testuser@example.com` login that `setup_local.sh` creates for local dev/Playwright.
  So CI only needs DynamoDB Local running + the 4 empty tables created - not the full
  `setup_local.sh` (which also needs `htpasswd`/`jq` and touches `FrontEnd/.env`).

**Design choice**: use a plain GitHub Actions DynamoDB Local *service container* + a shared table
-creation script (see below), rather than publishing a custom pre-built image (the issue's "might
require a pre-built container" was framed as a maybe) - simpler, no new registry/publishing
pipeline, and the four `create-table` calls take well under a second each.

Per discussion, extracted the table-creation logic (currently duplicated nowhere yet, but about to
be needed in two places) into a shared script rather than inlining `aws dynamodb create-table`
calls directly in the CI YAML - so local dev and CI provision the exact same schema from one place.

## Plan

- `scripts/create_dynamodb_tables.sh` (new)
  - Standalone, idempotent script: waits (up to 30s) for DynamoDB Local to be reachable, then
    creates `User`, `TransactionMonth`, `TransactionDescriptions`, `DescriptionMapping` (same
    schema as today's `setup_local.sh`) if they don't already exist. Endpoint/region default to
    `http://localhost:8000`/`us-east-1` (matching `Api/appsettings.Local.json`), overridable via
    `DYNAMO_ENDPOINT`/`DYNAMO_REGION` env vars.
- `scripts/setup_local.sh`
  - Drop its own `create_table_if_missing` function, the wait-loop, and the 4 explicit
    `create_table_if_missing` calls; call the new shared script instead. Everything else (docker
    container lifecycle, `FrontEnd/.env` copy, seeded test login/categories) stays as-is - it's
    local-dev/Playwright-only and irrelevant to the Api integration tests.
- `.github/workflows/dotnet.yml`
  - Add `Api.IntegrationTests/**` to both the `push` and `pull_request` `paths:` filters (currently
    missing - editing only integration test files wouldn't trigger this workflow at all today).
  - Add a new `integration-test` job (`needs: build`, matching the existing `test` job's shape):
    - `services.dynamodb-local` using `amazon/dynamodb-local:latest`, `ports: ["8000:8000"]`.
    - A step that just runs `scripts/create_dynamodb_tables.sh` (AWS CLI is already present on
      `ubuntu-latest` runners).
    - `dotnet restore Pim.sln` then
      `dotnet test Api.IntegrationTests/Pim.Api.IntegrationTests.csproj --configuration Release`.
- No application/test code changes expected - this is CI + local-tooling wiring only.

## Checklist

- [x] Add `scripts/create_dynamodb_tables.sh` (shared, idempotent table creation)
- [x] Update `scripts/setup_local.sh` to call the shared script instead of duplicating it
- [x] Verify `source scripts/setup_local.sh` still works end-to-end locally
- [x] Add `Api.IntegrationTests/**` to the workflow's path filters
- [x] Add the `integration-test` job with the DynamoDB Local service container
- [x] Validate the workflow YAML (actionlint if available, otherwise careful manual review)
- [ ] Push the branch and confirm the new job runs green on GitHub Actions
- [ ] Review diff and open PR

## Session log

### 2026-08-22

- Retrieved UBE-17 from Linear; flagged the conflict with the earlier UBE-13 "no CI integration
  tests" instruction and confirmed with the user before proceeding. Updated the corresponding
  memory to note it's superseded.
- Read `scripts/setup_local.sh`/`clean_local.sh`, `Api/appsettings.Local.json`,
  `ApiWebApplicationFactory.cs`, and `LoginEndpointTests.cs` to confirm how the integration tests
  get their DynamoDB connection and test data, and that they don't depend on the local-dev seeded
  login.
- Created this worklog and branch `UBE-17/add-integration-tests-to-ci` off `main`.
- User asked why not just reuse `setup_local.sh` directly - explained the extra deps
  (`htpasswd`)/side effects (`.env` copy, seeded login) it carries that CI doesn't need, and the
  container-lifecycle overlap with GH Actions' own `services:` block; agreed instead to extract
  just the table-creation logic into a shared script.
- Added `scripts/create_dynamodb_tables.sh` (idempotent, waits for DynamoDB Local then creates the
  4 tables) and updated `scripts/setup_local.sh` to call it instead of duplicating the logic.
  Verified `source scripts/setup_local.sh` end-to-end twice (fresh table creation, then idempotent
  skip on re-run).
- Added the `integration-test` job to `.github/workflows/dotnet.yml` (DynamoDB Local service
  container + the shared script + `dotnet test Api.IntegrationTests/...`), and added
  `Api.IntegrationTests/**`/`scripts/create_dynamodb_tables.sh` to the workflow's path filters
  (previously missing - the workflow wouldn't even trigger on integration-test-only changes).
- Validated the workflow YAML with Ruby's YAML parser (no `actionlint`/`shellcheck` available
  locally). Built the full solution and ran both `Api.UnitTests` (85 passed) and
  `Api.IntegrationTests` (59 passed) locally.
- Simulated the actual CI path end-to-end: started a fresh, isolated DynamoDB Local container (no
  pre-existing tables, mirroring a brand-new GH Actions service container) and ran
  `create_dynamodb_tables.sh` against it directly - confirmed the wait-loop and table creation work
  from a cold start, not just against the already-warm local dev instance.
- Remaining: push the branch, confirm the new job goes green on GitHub Actions, then open the PR.
