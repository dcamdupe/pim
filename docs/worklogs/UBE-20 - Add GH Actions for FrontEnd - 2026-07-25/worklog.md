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

- [ ] Add `.github/workflows/frontend.yml`
- [ ] Build job (compile via `npm run build`)
- [ ] Lint job (`npm run lint`)
- [ ] Unit test job (`npm run test` in `FrontEnd.UnitTests/`)
- [ ] Verify workflow runs green

## Notes

## Prompt Log

1. "start worklog in UBE-20"
