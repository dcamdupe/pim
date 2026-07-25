# UBE-14 — Add functional tests project for web

Linear: https://linear.app/uberconcept/issue/UBE-14/add-functional-tests-project-for-web

## Description

- TypeScript + Playwright, in a folder called `FunctionalTests`.
- Tests:
  - Login with valid login/password
  - Login with invalid login/password

## Context

- `FrontEnd/src/views/LoginView.vue` — the login form (`#login`, `#password` inputs, submit button), redirects to `/dashboard` on success, shows "Invalid login or password." on failure.
- `FrontEnd/src/services/authService.ts` — calls `POST {VITE_API_BASE_URL}/login` (defaults to `http://localhost:5037`, matching `Api`'s dev launch profile).
- A valid test login already exists for this: `testuser` / `TestPassword123!`, seeded via `scripts/setup_local.sh` (from UBE-10).
- Existing root-level layout convention: `Api`, `Api.UnitTests`, `Api.IntegrationTests`, `FrontEnd`, `FrontEnd.UnitTests` all sit at the repo root — the ticket names the new folder `FunctionalTests` (not `FrontEnd.FunctionalTests`), so it'll sit at the repo root too, following the ticket literally.

## Plan

1. Scaffold `FunctionalTests/` at the repo root: TypeScript + `@playwright/test`, its own `package.json`/`playwright.config.ts`.
2. Configure Playwright to launch/point at the Vite dev server (`FrontEnd`, default `http://localhost:5173`) and require the API (`Api`) + MongoDB to be running against the seeded test user.
3. Write `login.spec.ts`:
   - Valid login/password → redirected to `/dashboard`.
   - Invalid login/password → stays on `/login`, shows the error message.
4. Update `CLAUDE.md` to reference `FunctionalTests` and how to run it.
5. Verify the tests actually pass against the real stack (Api + Mongo + FrontEnd dev server).

## Checklist

- [ ] Scaffold `FunctionalTests` (TypeScript + Playwright)
- [ ] Add `login.spec.ts`: valid login/password
- [ ] Add `login.spec.ts`: invalid login/password
- [ ] Update `CLAUDE.md`
- [ ] Verify tests pass against the real stack

## Prompt Log

1. "create worklog for UBE-14"
