# UBE-9 — Add GitHub build actions for .Net project

Linear: https://linear.app/uberconcept/issue/UBE-9/add-github-build-actions-for-net-project

## Description

Add a GitHub Actions workflow for the .NET project with two stages:

- Build
- Unit test for .Net project

## Plan

1. Add a `.github/workflows/dotnet.yml` workflow that triggers on pushes/PRs touching the .NET project (`Api/`, `Api.Tests/`, `Pim.sln`).
2. Build stage: `dotnet restore` + `dotnet build` against `Pim.sln`.
3. Test stage: `dotnet test` against `Pim.sln`.
4. Pin a .NET SDK version matching the project's `net10.0` target framework.
5. Verify the workflow syntax and run it (push the branch / open the PR and check the Actions run).

## Checklist

- [x] Add `.github/workflows/dotnet.yml`
- [x] Build stage (`dotnet restore` + `dotnet build`)
- [x] Unit test stage (`dotnet test`)
- [x] Verify workflow runs successfully in GitHub Actions

## Notes

- Workflow runs on push to `main` and on pull requests, scoped to paths that affect the .NET project (`Api/**`, `Api.Tests/**`, `Pim.sln`, the workflow file itself).
- Two jobs: `build` (`dotnet restore` + `dotnet build` against `Pim.sln`, Release config) and `test` (`dotnet test` against `Pim.sln`, depends on `build` via `needs`).
- Pinned `dotnet-version: "10.0.x"` via `actions/setup-dotnet@v4` to match the local SDK (`10.0.101`) and the project's `net10.0` target framework.
- Verified locally: `dotnet restore`/`build --configuration Release`/`test --configuration Release` against `Pim.sln` all succeed (0 warnings/errors, `TreatWarningsAsErrors` still enforced).
- PR #4 opened; the `pull_request`-triggered Actions run (build + test) passed.

## Prompt Log

1. "start worklog for UBE-9"
2. "create the PR"
3. "the tests passed update the checklist"
