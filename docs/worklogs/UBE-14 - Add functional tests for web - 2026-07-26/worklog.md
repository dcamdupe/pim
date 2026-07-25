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

- [x] Scaffold `FunctionalTests` (TypeScript + Playwright)
- [x] Add `login.spec.ts`: valid login/password
- [x] Add `login.spec.ts`: invalid login/password
- [x] Update `CLAUDE.md`
- [x] Verify tests pass against the real stack

## Notes

- Scaffolded via `create-playwright` (`--lang=TypeScript --browser=chromium --no-examples --no-browsers`), then `npx playwright install chromium`. Chromium only for now (not firefox/webkit) to keep it lean.
- `playwright.config.ts`: `baseURL: http://localhost:5173`; `webServer` auto-starts the FrontEnd dev server (`npm run dev`, `cwd: ../FrontEnd`) with `reuseExistingServer` locally. Api + MongoDB are **not** auto-started — documented as prerequisites in `FunctionalTests/README.md`, matching how `Api.IntegrationTests` already requires Mongo running separately rather than orchestrating it.
- `tests/login.spec.ts`: two scenarios using the `testuser`/`TestPassword123!` login seeded by `scripts/setup_local.sh` — valid credentials redirect to `/dashboard`; invalid credentials stay on `/login` and show the `.form-error` text.
- Hit a real bug while verifying: the FrontEnd dev server (left running from earlier manual testing) was serving stale Vite-optimized deps (`504 Outdated Optimize Dep`), which silently prevented the Vue app from mounting (`#login` never appeared, tests timed out on `locator.fill`). Fixed by killing the stray process and clearing `FrontEnd/node_modules/.vite`. Not a code bug — just a reminder that a stale local dev server can make tests flake; not addressed in code since it's an environment/caching issue, not a project defect.
- Verified against the real stack: Mongo running, `scripts/setup_local.sh` run, `Api` running on `:5037`, then `npm test` in `FunctionalTests` — both tests pass, twice in a row (2.1–3.3s).
- `CLAUDE.md` updated: `FunctionalTests` listed under Project, plus a Commands entry (`npm test`, prerequisites, "new user-facing flows should have a corresponding scenario here").

## Prompt Log

1. "create worklog for UBE-14"
2. "start"
