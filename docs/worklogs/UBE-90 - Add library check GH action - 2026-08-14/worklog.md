# UBE-90: Add a library check github action

Linear: https://linear.app/uberconcept/issue/UBE-90/add-a-library-check-github-action
Status: In Progress · Priority: No priority

## Description (from Linear)

This should run daily and check that there are no nuget or npm packages with high severity
vulnerabilities.

## Current state

- `.github/workflows/dotnet.yml`'s `build` job already has a "Fail on critical vulnerable NuGet
  packages" step (`dotnet list Pim.sln package --vulnerable --include-transitive` grepped for
  `critical`) - but only `critical`, not `high`, and only runs on `push`/`pull_request` to
  Api-related paths, never on a schedule (so a newly-disclosed CVE against an unchanged dependency
  is never caught).
- `.github/workflows/frontend.yml`'s `build` job runs a plain `npm audit` (default audit level) in
  `FrontEnd/` only, also only on `push`/`pull_request`, not scheduled.
- Four independent npm projects exist, each with its own `package.json`/`package-lock.json`/
  `node_modules` (confirmed via `find . -maxdepth 2 -name package.json`): `FrontEnd/`,
  `FrontEnd.UnitTests/`, `FunctionalTests/`, `FileDownloader/`. Only `FrontEnd/` is currently
  audited anywhere.
- `Pim.sln` covers all 3 .NET projects (`Api`, `Api.UnitTests`, `Api.IntegrationTests`) - a single
  `dotnet list Pim.sln package --vulnerable` already covers the whole solution.
- No `actionlint`/`act` available locally to dry-run the new workflow YAML - verification will be
  a careful review plus a real `gh workflow run --ref <branch>` dispatch before merging.

## Plan

1. New `.github/workflows/library-check.yml`:
   - Triggers: `schedule` (daily cron) + `workflow_dispatch` (so it can be tested on-demand from
     this branch before relying on the schedule, and re-run manually later if needed).
   - `dotnet` job: checkout, `setup-dotnet`, `dotnet restore Pim.sln`, then
     `dotnet list Pim.sln package --vulnerable --include-transitive`, failing the step if any
     `High` or `Critical` entries are present (broader than `dotnet.yml`'s existing critical-only
     gate, but that one stays as-is - it's a fast, code-change-triggered check; this one is the
     scheduled, severity-broadened sweep the ticket asks for).
   - `npm` job: matrix over the four npm project directories, each: checkout, `setup-node` (cache
     keyed to that directory's `package-lock.json`), `npm ci`, `npm audit --audit-level=high`.
2. Review the new YAML carefully (no local `actionlint`/`act`) - triggers, matrix `working-directory`
   wiring, cache keys.
3. Push the branch and `gh workflow run library-check.yml --ref UBE-90/add-library-check-gh-action`
   to confirm it actually runs (and currently passes, since nothing here is genuinely vulnerable
   today) before merging - a schedule-only trigger can't be verified any other way pre-merge.

## Checklist

- [x] New `.github/workflows/library-check.yml` - `dotnet` job (High/Critical NuGet check) +
      `npm` job (matrix of 4 directories, `npm audit --audit-level=high`), `schedule` +
      `workflow_dispatch` triggers
- [x] YAML reviewed for correctness (trigger syntax, matrix `working-directory`, cache keys) -
      parses cleanly (`Ruby YAML.load_file`); no `actionlint`/`act` available locally for a deeper
      check
- [ ] Manually dispatched via `gh workflow run` to confirm a real run passes - blocked: GitHub
      only registers a `workflow_dispatch` workflow once its file exists on the *default* branch
      (confirmed: `gh workflow run library-check.yml --ref <this branch>` → 404 "not found on the
      default branch"; `gh workflow list` doesn't show it either). Can't be verified until after
      this merges to `main` - flagged to the user rather than merging/dispatching unprompted.

## Prompt log

- "start a worklog for UBE-90" → fetched issue from Linear, read the existing
  `dotnet.yml`/`frontend.yml` workflows and enumerated the repo's npm/`.csproj` projects to scope
  what a daily vulnerability-check workflow needs to cover, wrote this worklog
