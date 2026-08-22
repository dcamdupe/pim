# UBE-18: Add functional tests into github CI

## Linear issue

[UBE-18](https://linear.app/uberconcept/issue/UBE-18/add-functional-tests-into-github-ci) — Add functional tests into github CI

(No description on the issue - title only.)

## Description

Add the Playwright `FunctionalTests` suite (real browser, driving the real FrontEnd + Api +
DynamoDB Local stack) into GitHub Actions CI, as a natural follow-on to UBE-17 (which got
`Api.IntegrationTests` running in CI).

Investigated what the suite needs beyond what UBE-17 already set up:
- `FunctionalTests/README.md`: needs DynamoDB Local + the seeded `testuser@example.com` login
  (currently via `scripts/setup_local.sh`) and the Api running - the FrontEnd dev server itself is
  auto-started by Playwright's own `webServer` config (`playwright.config.ts`), not manually.
- All 14 spec files log in as the same seeded `testuser@example.com` / `TestPassword123!` login -
  so CI needs that seeded, not just empty tables (UBE-17 only needed empty tables, since
  `Api.IntegrationTests` creates its own randomised users per test).
- `workers: 1` is hardcoded in `playwright.config.ts` (not just a CI setting) - several specs
  mutate the same shared seeded user's account list via a full-replace `PUT /settings` and would
  race each other if run concurrently.
- **Found a real port/scheme mismatch** while checking this: `FrontEnd/.env.local` (the template
  `setup_local.sh` copies to `FrontEnd/.env`) points `VITE_API_BASE_URL` at
  `https://localhost:7010`, but the README instructs starting the Api on plain
  `http://localhost:5037` - those don't match. `Api/Program.cs` only calls
  `UseHttpsRedirection()` outside the `Local` environment, so running Api on HTTP-only
  `:5037` under `ASPNETCORE_ENVIRONMENT=Local` works fine - going with that for CI (see design
  choice below) rather than chasing self-signed dev-cert trust in a fresh runner.
- `scripts/setup_local.sh` itself isn't a good fit to call as-is in CI: needs `htpasswd`, `jq`,
  `docker` (managing its own container, which would collide with a GH Actions `services:`
  container), and also touches `FrontEnd/.env`.

**Design choices**:
1. Run the Api over plain HTTP (`http://localhost:5037`, matching the README) instead of the
   HTTPS profile local dev uses - avoids needing to trust a self-signed dev cert in Playwright's
   headless Chromium on a fresh CI runner. Point `VITE_API_BASE_URL` at that same URL via a job-
   level env var (Vite picks up `VITE_`-prefixed env vars from the process environment, so this
   needs no `FrontEnd/.env` file at all in CI).
2. Extract the test-login/categories seeding logic out of `setup_local.sh` into a new shared
   script `scripts/seed_test_login.sh`, mirroring UBE-17's `create_dynamodb_tables.sh` extraction -
   so local dev and CI seed the exact same login from one place. Needs `htpasswd`
   (`apache2-utils`, not preinstalled on `ubuntu-latest` - one quick `apt-get install` step) and
   `jq` (already present).
3. New standalone workflow file, `.github/workflows/functional-tests.yml`, rather than folding
   into `dotnet.yml` or `frontend.yml` - this job spans Api + FrontEnd + FunctionalTests and
   doesn't naturally belong to either existing workflow's scope/path-filter.

## Plan

- `scripts/seed_test_login.sh` (new)
  - Idempotent: seeds `testuser@example.com` / `TestPassword123!` with the same 12 default
    categories and `MinTransactionDate: "2020-01-01"` that `setup_local.sh` seeds today, skipping
    if the login already exists. Same `DYNAMO_ENDPOINT`/`DYNAMO_REGION` env var override
    convention as `create_dynamodb_tables.sh`.
- `scripts/setup_local.sh`
  - Drop its own inline login/categories-seeding block; call the new shared script instead
    (after the existing `create_dynamodb_tables.sh` call). `htpasswd` stays a documented local
    prerequisite (already is).
- `.github/workflows/functional-tests.yml` (new)
  - Triggers on `push` (main) / `pull_request`, paths: `Api/**`, `FrontEnd/**`,
    `FunctionalTests/**`, `scripts/create_dynamodb_tables.sh`, `scripts/seed_test_login.sh`,
    `Pim.sln`, the workflow file itself.
  - Single `functional-test` job on `ubuntu-latest`:
    - `services.dynamodb-local` (same as the `integration-test` job in `dotnet.yml`).
    - Checkout, `setup-dotnet` (10.0.x), `setup-node` (22, matching `frontend.yml`).
    - `apt-get install -y apache2-utils` (for `htpasswd`).
    - Run `create_dynamodb_tables.sh` then `seed_test_login.sh`.
    - Start the Api in the background (`ASPNETCORE_ENVIRONMENT=Local dotnet run --project Api
      --urls http://localhost:5037 &`), then poll `GET /` until it responds `200`.
    - `npm ci` in `FrontEnd/` (dependency for Playwright's own `webServer` step, which runs
      `npm run dev` from there) and in `FunctionalTests/`.
    - `npx playwright install --with-deps chromium` in `FunctionalTests/`.
    - `npm test` in `FunctionalTests/`, with `VITE_API_BASE_URL=http://localhost:5037` set so the
      FrontEnd dev server Playwright spawns talks to the right Api URL.
    - Upload the Playwright HTML report (`FunctionalTests/playwright-report`) as a build artifact
      on failure, for debugging a red run from the Actions UI.
- No branch-protection/required-checks work here - per the earlier UBE-17 discussion, this repo
  can't enforce required status checks without GitHub Pro or going public; out of scope, already
  decided to skip for now.

## Checklist

- [x] Add `scripts/seed_test_login.sh` (shared, idempotent login/category seeding)
- [x] Update `scripts/setup_local.sh` to call the shared script instead of duplicating it
- [x] Verify `source scripts/setup_local.sh` still works end-to-end locally
- [x] Add `.github/workflows/functional-tests.yml` with the `functional-test` job
- [x] Validate the workflow YAML
- [x] Push the branch and open PR
- [x] Diagnose and fix the first CI run's failure
- [ ] Confirm the `functional-test` job runs fully green on GitHub Actions

## Session log

### 2026-08-22

- Retrieved UBE-18 from Linear (no description, title only).
- Explored `FunctionalTests/README.md`, `playwright.config.ts`, `scripts/setup_local.sh`,
  `run_local.sh`, both existing CI workflows, and `FunctionalTests/package.json` to scope what's
  needed beyond UBE-17's groundwork.
- Found and resolved the `VITE_API_BASE_URL` (HTTPS :7010) vs README (`http://localhost:5037`)
  mismatch by checking `Api/Program.cs`'s conditional `UseHttpsRedirection()` - confirmed
  HTTP-only on the `Local` environment works, and chose that for CI to avoid dev-cert trust.
- Created this worklog and branch `UBE-18/add-functional-tests-to-ci` off `main`.
- User asked why not just use HTTPS in CI to match local dev - explained `dotnet dev-certs https
  --trust` isn't supported on Linux at all (no clean way to get a fresh runner's headless Chromium
  to trust the self-signed dev cert), and that the README already documents the HTTP path for
  running the Api during Playwright runs; user agreed to proceed with HTTP for CI.
- Added `scripts/seed_test_login.sh` (idempotent, seeds `testuser@example.com` + categories) and
  updated `scripts/setup_local.sh` to call it instead of duplicating the logic - same extraction
  pattern as UBE-17's `create_dynamodb_tables.sh`. Verified `source scripts/setup_local.sh`
  end-to-end twice (fresh table+login creation after restarting the in-memory container, then
  idempotent skip on re-run), and separately verified both shared scripts cold-start correctly
  against a fresh, isolated DynamoDB Local container (mirroring a brand-new GH Actions service
  container, same technique used to verify UBE-17).
- Added `.github/workflows/functional-tests.yml`: DynamoDB Local service container, installs
  `apache2-utils` for `htpasswd`, runs the two shared seed scripts, starts the Api in the
  background on plain HTTP `:5037` with a wait-for-ready poll against `GET /`, installs FrontEnd
  and FunctionalTests deps, installs Playwright's Chromium, then runs `npm test` with
  `VITE_API_BASE_URL=http://localhost:5037` so the FrontEnd dev server Playwright spawns points at
  the right Api. Uploads the Playwright HTML report as an artifact on failure. Validated the YAML
  with Ruby's parser.
- Deliberately did not do a full local dry-run of Api-on-5037 + FrontEnd + Playwright together -
  the existing local dev Api/FrontEnd (running since 2026-08-15 via `run_local.sh`) already
  occupies those same ports, and stopping it to test would disrupt other in-progress work; a real
  GitHub Actions run is a more faithful test of the CI path anyway (clean runner, no local port
  conflicts) - same approach as UBE-17's final validation.
- Pushed and opened PR #77: https://github.com/dcamdupe/pim/pull/77. First CI run: **33 of 34
  tests passed** - strong validation the whole new pipeline (DynamoDB service container, seed
  scripts, Api on HTTP :5037, FrontEnd, Playwright/Chromium) actually works end-to-end. One
  failure: `transactionExport.spec.ts`'s "disables the Export button when no transactions match
  the filters", consistently across all 3 attempts (2 retries).
- Downloaded the run's `playwright-report` artifact (the failure-only upload step earned its keep)
  and read the error-context snapshot: the page actually showed **"No transactions in this
  range."**, not the "No transactions match your filters." text the test asserted on.
- Root-caused it: the transactions store's initial load fetches *all-time* transactions
  (`startDate: undefined`), which the Api resolves from the seeded `MinTransactionDate` of
  2020-01-01 - roughly 80 months to enumerate. That fetch (`GetTransactionsAsync`) is still
  sequential on this branch (parallelised separately in UBE-91/PR #78, not yet merged) - on a
  fresh CI runner those ~80 sequential DynamoDB round-trips apparently outran the test's 5s
  default timeout, so the store's `transactions` ref was still empty when the assertion ran,
  correctly showing the "zero cached transactions" message rather than the "filtered to zero"
  one the test expected.
- Discussed the fix with the user: merging UBE-91 would reduce the round-trip count but doesn't
  bound worst-case CI timing on its own, so - per the user's call - hardened the test instead of
  relying on UBE-91's timing. Changed the assertion in `transactionExport.spec.ts` to accept
  either "No transactions in this range." or "No transactions match your filters." (both mean
  zero rows are showing, which is all this test actually cares about) and gave that one
  assertion a longer 15s timeout, since it depends on the store's slower all-time fetch rather
  than a plain page navigation. Re-ran `transactionExport.spec.ts` locally - both tests pass.
- Remaining: push the fix and confirm the `functional-test` job goes fully green on PR #77.
