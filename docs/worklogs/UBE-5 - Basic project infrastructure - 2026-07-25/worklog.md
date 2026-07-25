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

- [ ] Create `docs/design` directory
- [ ] Scaffold `Api` (.NET Core web API)
- [ ] Scaffold `FrontEnd` (Vue.js static web app)
- [ ] Verify `Api` builds/runs
- [ ] Verify `FrontEnd` builds/runs
- [ ] Update root `.gitignore` for new project types

## Prompt Log

1. "create a worklog for UBE-5"
