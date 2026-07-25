# UBE-7 — Add front end unit tests project

Linear: https://linear.app/uberconcept/issue/UBE-7/add-front-end-unit-tests-project

## Description

Add a unit test project/setup for the `FrontEnd` (Vue 3 + TypeScript + Vite) app. No test framework is currently configured there (per `CLAUDE.md`). The Linear issue has no further description — scope below is inferred from the title and the existing `Api.UnitTests` convention (a dedicated, easily runnable test project alongside the app it covers).

## Plan

1. Add `vitest`, `@vue/test-utils`, and `jsdom` as FrontEnd devDependencies.
2. Configure Vitest (test block in `vite.config.ts` or a dedicated `vitest.config.ts`) with the `jsdom` environment.
3. Add a `test` script to `FrontEnd/package.json`.
4. Add an initial unit test to prove the setup works (covering `authService.ts`).
5. Update `CLAUDE.md`'s FrontEnd commands section to document the new test command (replacing "No test framework is configured yet").
6. Verify: run the new test script and confirm it passes.

## Checklist

- [ ] Add `vitest` / `@vue/test-utils` / `jsdom` devDependencies
- [ ] Configure Vitest (jsdom environment)
- [ ] Add `test` script to `package.json`
- [ ] Add an initial unit test
- [ ] Update `CLAUDE.md` FrontEnd commands section
- [ ] Verify tests run and pass

## Notes

## Prompt Log

1. "create a worklog for UBE-7"
