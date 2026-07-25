# UBE-7 — Add front end unit tests project

Linear: https://linear.app/uberconcept/issue/UBE-7/add-front-end-unit-tests-project

## Description

Add a unit test project/setup for the `FrontEnd` (Vue 3 + TypeScript + Vite) app. No test framework is currently configured there (per `CLAUDE.md`). The Linear issue has no further description — scope below is inferred from the title and the existing `Api.UnitTests` convention (a dedicated, easily runnable test project alongside the app it covers).

## Plan

1. Create a separate `FrontEnd.UnitTests/` project (own `package.json`/`node_modules`, not a `FrontEnd/` workspace) mirroring how `Api.UnitTests` sits alongside `Api`, with `vitest`, `@vue/test-utils`, `jsdom`, and `@vitejs/plugin-vue` as devDependencies.
2. Configure Vitest (`vitest.config.ts`) in `FrontEnd.UnitTests/` with the `jsdom` environment.
3. Add a `test` script to `FrontEnd.UnitTests/package.json`.
4. Add an initial unit test to prove the setup works, covering `authService.ts` (imported from `FrontEnd/src` via a relative path), in a directory layout mirroring `FrontEnd/src` (e.g. `FrontEnd.UnitTests/services/`).
5. Update `CLAUDE.md`'s Project/Commands sections to document `FrontEnd.UnitTests/` and its test command (replacing "No test framework is configured yet").
6. Verify: run the new test script and confirm it passes; confirm `FrontEnd/` still builds/lints cleanly (no test tooling leaked into the app package).

## Checklist

- [x] Create `FrontEnd.UnitTests/` project with `vitest` / `@vue/test-utils` / `jsdom` devDependencies
- [x] Configure Vitest (jsdom environment)
- [x] Add `test` script to `FrontEnd.UnitTests/package.json`
- [x] Add an initial unit test (`authService.ts`)
- [x] Update `CLAUDE.md` Project/Commands sections
- [x] Verify tests run and pass; `FrontEnd/` still builds/lints cleanly

## Notes

- Initially set Vitest up directly inside `FrontEnd/` (test deps in `FrontEnd/package.json`, `test` block in `FrontEnd/vite.config.ts`, colocated `src/services/authService.test.ts`) — per feedback, moved to a standalone `FrontEnd.UnitTests/` project instead, matching the `Api`/`Api.UnitTests` split. `FrontEnd/package.json` and `vite.config.ts` were reverted to their pre-test state.
- `FrontEnd.UnitTests/services/authService.test.ts` imports `login`/`LoginFailedError` from `../../FrontEnd/src/services/authService` (relative path — no path alias or project reference mechanism in npm/TS for this, unlike a C# project reference) and mocks `global.fetch` via `vi.stubGlobal` to cover the success (200 + token) and failure (non-2xx → `LoginFailedError`) cases.
- `npm install` for `FrontEnd.UnitTests/` is separate from `FrontEnd/`'s.

## Prompt Log

1. "create a worklog for UBE-7"
2. "start"
3. "move the tests into a separate project, FrontEnd.UnitTests"
