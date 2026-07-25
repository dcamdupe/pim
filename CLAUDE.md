# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

PIM — a personal finance manager for a single user (David Cameron). Early-stage: `Api/` and `FrontEnd/` are currently scaffolds, not yet wired to real domain logic.

- `Api/` — .NET Core Web API (`Pim.Api`, targets `net10.0`). No `.sln` file — build/run against the `.csproj` directly.
- `FrontEnd/` — Vue 3 + TypeScript + Vite SPA, with `vue-router` and `pinia`.
- `docs/worklogs/` and `docs/design/` — see global worklog conventions in `~/.claude/CLAUDE.md`.
- MongoDB is the intended datastore (not yet wired into the Api).

## Commands

**Api** (from repo root):
- Build: `dotnet build Api/Pim.Api.csproj`
- Run: `dotnet run --project Api`
- No test project exists yet.

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
