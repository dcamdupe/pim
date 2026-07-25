# UBE-5 — Create basic project infrastructure

Linear: https://linear.app/uberconcept/issue/UBE-5/create-basic-project-infrastructure

## Description

Set up the base repository structure for the PIM project:

- `docs`
  - `worklogs` — worklogs for individual tasks
  - `design` — any design or features
- `Api` — .NET Core web API
- `FrontEnd` — Vue.js static web application

## Plan

1. Create the `docs/design` directory (`docs/worklogs` already exists as of this worklog).
2. Scaffold the `Api` folder with a new .NET Core web API project.
3. Scaffold the `FrontEnd` folder with a new Vue.js static web application.
4. Verify both projects build/run locally.
5. Add root-level config (`.gitignore`, etc.) as needed for the new project types.

## Checklist

- [x] Create `docs/design` directory
- [x] Scaffold `Api` (.NET Core web API)
- [x] Scaffold `FrontEnd` (Vue.js static web app)
- [x] Verify `Api` builds/runs
- [x] Verify `FrontEnd` builds/runs
- [x] Update root `.gitignore` for new project types (root `.gitignore` already covers .NET build output; `FrontEnd` has its own `.gitignore` from the Vite scaffold covering `node_modules`/`dist`)

## Notes

- `Api` scaffolded with `dotnet new webapi -o Api -n Pim.Api` (targets net10.0). Builds cleanly (`dotnet build`); one pre-existing NU1903 advisory warning from the template's default `Microsoft.OpenApi` package version, not introduced by this work.
- `FrontEnd` scaffolded with `npm create vite@latest FrontEnd -- --template vue-ts`, then `vue-router` and `pinia` were added and wired up in `main.ts`/`App.vue`, plus `eslint` + `eslint-plugin-vue` + `@vue/eslint-config-typescript` with a flat `eslint.config.js`, mirroring what `create-vue --typescript --router --pinia --eslint` would produce.
  - `create-vue`'s interactive prompt (built on `@clack/prompts`) could not be driven non-interactively even via piped stdin or a pseudo-tty (`script`), so `create-vite` was used instead as a reliable non-interactive path.
  - Local Node was v11.7.0 (too old for modern Vue tooling); installed Node 20 then Node 22 via `nvm` to satisfy `create-vue`/`create-vite` engine requirements (only used for this scaffold session, not set as the nvm default).
- Verified: `npm run lint` (clean), `npm run build` (succeeds), and `npm run dev` serves on `http://localhost:5173/` (200 OK).

## Prompt Log

1. "create a worklog for UBE-5"
2. "Scaffold the Api and FrontEnd folders"
