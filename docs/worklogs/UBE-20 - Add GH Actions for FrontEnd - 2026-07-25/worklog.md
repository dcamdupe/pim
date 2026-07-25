# UBE-20 — Create github action for front end

Linear: https://linear.app/uberconcept/issue/UBE-20/create-github-action-for-front-end

## Description

- build
  - compile front end
  - lint front end
- run unit tests

## Plan

1. Add `.github/workflows/frontend.yml`, mirroring the structure/conventions of the existing `.github/workflows/dotnet.yml` (path-filtered on `push`/`pull_request` to `main`, separate jobs, `needs:` chaining).
2. Build job: checkout, `actions/setup-node@v4` (Node 22, matching the local `nvm use 22` requirement), `npm ci` + `npm run build` in `FrontEnd/` (build runs `vue-tsc -b` then `vite build`, so this covers "compile").
3. Lint job (or step): `npm ci` + `npm run lint` in `FrontEnd/`. Note `lint` runs `eslint . --fix` (auto-fixes) — CI can't commit fixes back, so it will only fail on unfixable errors; that's an existing repo characteristic, not something to change here.
4. Test job: `npm ci` + `npm run test` in `FrontEnd.UnitTests/` (separate `package.json`/`node_modules` from `FrontEnd/`, per `CLAUDE.md`).
5. Trigger paths should cover `FrontEnd/**`, `FrontEnd.UnitTests/**`, and the workflow file itself.
6. Verify the workflow syntax/structure is sound (e.g. `actionlint` if available, otherwise careful review) and, if convenient, push and confirm it runs green in GitHub Actions.

## Checklist

- [x] Add `.github/workflows/frontend.yml`
- [x] Build job (compile via `npm run build`)
- [x] Lint job (`npm run lint`)
- [x] Unit test job (`npm run test` in `FrontEnd.UnitTests/`)
- [ ] Verify workflow runs green

## Notes

- `build`, `lint`, and `test` are independent jobs (no `needs:` chaining) — unlike `dotnet.yml`'s `test needs: build`, none of these three depend on another's output (each does its own `npm ci`), so running them in parallel is safe and faster.
- No `actionlint`/`yamllint` available locally to validate the workflow syntax directly; instead ran the exact commands the workflow invokes (`npm ci` then `npm run build` / `npm run lint` in `FrontEnd/`, `npm ci` then `npm run test` in `FrontEnd.UnitTests/`) locally — all pass.
- **CI-only failure, not reproducible locally:** the `test` job failed in GitHub Actions with `[TSCONFIG_ERROR] Failed to load tsconfig for '../FrontEnd/src/services/authService.ts': Tsconfig not found` (via Vite's `vite:oxc` plugin). Root cause: Vite/Vitest's per-file tsconfig auto-discovery walks up from the transformed file's own directory, not from `FrontEnd.UnitTests`' — so for a source file under `FrontEnd/src/services/`, the nearest ancestor `tsconfig.json` it finds is `FrontEnd/tsconfig.json`, which is solution-style (`"files": []` + `"references"`, no `compilerOptions`) and apparently isn't resolved correctly by Vite 8's Oxc-based transformer on a fresh Linux CI install (didn't reproduce on macOS locally, even with a clean `npm ci`).
  - First attempt — set `oxc: false` + `esbuild.tsconfigRaw` in `FrontEnd.UnitTests/vitest.config.ts` to force the esbuild transform pipeline (which supports bypassing tsconfig discovery) — silenced a local "esbuild options will be ignored" warning, but CI still failed with the same error via `vite:oxc`, meaning the top-level `oxc: false` didn't actually disable Oxc for Vitest's own module-transform path. Reverted this — it wasn't fixing the real problem.
  - Actual fix: added a minimal, self-contained `FrontEnd/src/tsconfig.json` (no `extends`/`references`) so the ancestor walk from `FrontEnd/src/services/authService.ts` finds a directly-loadable config *before* reaching `FrontEnd/tsconfig.json`. Confirmed this doesn't affect `FrontEnd`'s own tooling: `vue-tsc -b` follows explicit `references` only (doesn't do directory-walk discovery, so it never sees this file), and the project's ESLint config uses the plain `recommended` (non-type-checked) preset, not `recommendedTypeChecked`, so it doesn't use `projectService`-based tsconfig auto-discovery either — verified `npm run build`/`npm run lint` in `FrontEnd/` are unaffected.

## Prompt Log

1. "start worklog in UBE-20"
2. "start"
3. "create the PR"
4. "the tests faile in gh with this error: [TSCONFIG_ERROR] ... Tsconfig not found"
5. "still failing" (same error, after the oxc:false/esbuild.tsconfigRaw attempt)
