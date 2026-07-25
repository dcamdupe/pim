# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

PIM — a personal finance manager for a single user (David Cameron). Early-stage: `Api/` and `FrontEnd/` are currently scaffolds, not yet wired to real domain logic.

- `Api/` — .NET Core Web API (`Pim.Api`, targets `net10.0`), backed by MongoDB via a generic `IRepository<T>`/`MongoRepository<T>`.
- `Api.Tests/` — xUnit test project (`Pim.Api.Tests`) referencing `Api`.
- `Pim.sln` ties `Api` and `Api.Tests` together — build/test from the repo root.
- `FrontEnd/` — Vue 3 + TypeScript + Vite SPA, with `vue-router` and `pinia`.
- `docs/worklogs/` and `docs/design/` — see global worklog conventions in `~/.claude/CLAUDE.md`.

## Commands

**Api** (from repo root):
- Build: `dotnet build`
- Run: `dotnet run --project Api`
- Test: `dotnet test`
- `TreatWarningsAsErrors` is enabled on `Pim.Api` — analyzer warnings fail the build.
- Requires a local MongoDB instance (`mongodb://localhost:27017` by default, see `Api/appsettings.json`) — `GET /` pings Mongo and returns `503` if it's unreachable.

**FrontEnd** (from `FrontEnd/`):
- Dev server: `npm run dev`
- Build: `npm run build` (runs `vue-tsc -b` then `vite build`)
- Lint: `npm run lint` — this runs `eslint . --fix` and auto-fixes; there is no separate check-only lint script.
- No test framework is configured yet.

Node's `nvm` default on this machine is a very old version (v11) — too old for Vite/Vue tooling. Run `nvm use 22` (or `nvm install 22`) before running any FrontEnd npm command if you hit engine errors.

## Conventions

- Branches: `<Linear-ID>/<kebab-case-description>`, branched off `main` (e.g. `UBE-5/basic-project-infrastructure`).
- Commits: short, lowercase, imperative (e.g. `started to create structure of project`).
- Issue tracking is in Linear (project "PIM", team "Uberconcept").
