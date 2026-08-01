# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

PIM — a personal finance manager for a single user (David Cameron). Early-stage: `Api/` and `FrontEnd/` are currently scaffolds, not yet wired to real domain logic.

- `Api/` — .NET Core Web API (`Pim.Api`, targets `net10.0`), backed by DynamoDB via a generic `IRepository<T>`/`DynamoDbRepository<T>` (a local DynamoDB Local emulator container stands in for real DynamoDB in local dev).
- `Api.UnitTests/` — xUnit unit test project (`Pim.Api.UnitTests`) referencing `Api`.
- `Api.IntegrationTests/` — xUnit functional test project (`Pim.Api.IntegrationTests`), hosting `Api` in-process via `WebApplicationFactory<Program>` and hitting real endpoints (against a real local DynamoDB Local emulator). Every API endpoint must be covered by a functional test here.
- `Pim.sln` ties `Api`, `Api.UnitTests`, and `Api.IntegrationTests` together — build/test from the repo root.
- `FrontEnd/` — Vue 3 + TypeScript + Vite SPA, with `vue-router` and `pinia`.
- `FrontEnd.UnitTests/` — Vitest unit test project (own `package.json`/`node_modules`, not a workspace of `FrontEnd/`), importing source from `FrontEnd/src` via relative paths, with a directory layout mirroring it (e.g. `FrontEnd.UnitTests/services/authService.test.ts` covers `FrontEnd/src/services/authService.ts`).
- `FunctionalTests/` — TypeScript + Playwright end-to-end tests (own `package.json`/`node_modules`), driving the real FrontEnd + Api + DynamoDB Local stack in a browser. See `FunctionalTests/README.md` for prerequisites.
- `Terraform/` — AWS infrastructure (VPC, CloudFront+S3 frontend, DynamoDB, API Gateway + Lambda). One shared root config; `environment` is a variable (`environments/<name>.tfvars` + a matching Terraform workspace), not a per-environment folder. See `Terraform/README.md`.
- `docs/worklogs/` and `docs/design/` — see global worklog conventions in `~/.claude/CLAUDE.md`.

## Commands

**Starting the app for local testing/dev:** `scripts/run_local.sh` builds and starts both `Api` and
`FrontEnd` together (killing anything already on their ports first, so it's always safe to re-run;
`Ctrl+C` stops both). Requires `source scripts/setup_local.sh` already done at least once (starts
the local DynamoDB emulator). Prefer this over manually running `dotnet run --project Api`/`npm run dev` separately
unless you specifically only need one of the two running.

**Api** (from repo root):
- Build: `dotnet build`
- Run: `dotnet run --project Api`
- Test: `dotnet test`
- `TreatWarningsAsErrors` is enabled on `Pim.Api` — analyzer warnings fail the build.
- Requires a local DynamoDB Local emulator (`http://localhost:8000` by default, see `Api/appsettings.Local.json` and `scripts/setup_local.sh`). `Api.IntegrationTests` also needs it running since it exercises the real endpoints/DB, not mocks.
- New endpoints must have a corresponding functional test added to `Api.IntegrationTests`.
- Every authenticated endpoint must have an entry in `Api.IntegrationTests/AuthorizationTests.cs`'s
  `ProtectedEndpoints()` list, so the cross-cutting "no token → 401" check (UBE-46) covers it too.
- Do not write `Api.UnitTests` for controllers - controllers are covered by `Api.IntegrationTests`
  hitting the real endpoints instead; put unit tests on the services/logic underneath them.

**FrontEnd** (from `FrontEnd/`):
- Dev server: `npm run dev`
- Build: `npm run build` (runs `vue-tsc -b` then `vite build`)
- Lint: `npm run lint` — this runs `eslint . --fix` and auto-fixes; there is no separate check-only lint script.

**FrontEnd.UnitTests** (from `FrontEnd.UnitTests/`, separate `npm install` from `FrontEnd/`):
- Test: `npm run test` (Vitest, `jsdom` environment, single run — not watch mode).

**FunctionalTests** (from `FunctionalTests/`, separate `npm install` from `FrontEnd/`):
- Test: `npm test` (Playwright). Auto-starts the FrontEnd dev server; requires the DynamoDB Local emulator + `Api` already running separately (see `FunctionalTests/README.md`).
- New user-facing flows should have a corresponding scenario added here.

**Terraform** (from `Terraform/`):
- `terraform fmt -recursive` / `terraform validate` — safe to run anytime, no AWS credentials needed.
- `terraform plan`/`apply` need real AWS credentials — **never use root account credentials** for this (a dedicated least-privilege IAM identity should be created first). Not run from this environment so far; see `Terraform/README.md`.
- `Terraform/bootstrap/` (S3 state bucket) must exist before the root config's `backend.tf` will work. No state locking (no DynamoDB lock table) - applies are done by one person, serially.

## Conventions

- Branches: `<Linear-ID>/<kebab-case-description>`, branched off `main` (e.g. `UBE-5/basic-project-infrastructure`).
- Commits: short, lowercase, imperative (e.g. `started to create structure of project`).
- Issue tracking is in Linear (project "PIM", team "Uberconcept").
- Api controllers: specify the full route on the HTTP method attribute (e.g. `[HttpGet("settings")]`, `[HttpPost("login")]`), not via a class-level `[Route(...)]`. Every action's endpoint is readable from its own attribute without having to check the controller class.
