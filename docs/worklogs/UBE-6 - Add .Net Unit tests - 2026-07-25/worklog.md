# UBE-6 — Add .Net Unit tests

Linear: https://linear.app/uberconcept/issue/UBE-6/add-net-unit-tests

## Description

Add a unit tests project for the .NET API using xUnit. No tests need to be added yet — this is just the project scaffolding.

## Plan

1. Create a new xUnit test project (e.g. `Api.Tests`) alongside `Api`.
2. Add a project reference from `Api.Tests` to `Api`.
3. Confirm `dotnet test` runs successfully against the empty project.
4. Consider adding a solution file (`.sln`) if it helps running both projects together (currently `Api` is built directly against its `.csproj`, no `.sln` exists).

## Checklist

- [x] Create `Api.Tests` xUnit project
- [x] Reference `Api` from `Api.Tests`
- [x] Verify `dotnet test` runs (0 tests, no errors)
- [x] Decide on / add a `.sln` if needed

## Notes

- Scaffolded via `dotnet new xunit -o Api.Tests -n Pim.Api.Tests`; added a `ProjectReference` to `Api/Pim.Api.csproj`.
- Removed the template's placeholder `UnitTest1.cs` — the ticket explicitly says no tests need to be added yet, so the project is genuinely empty rather than containing a fake passing test.
- `dotnet test` exits 0 with "No test is available" (expected/informational, not an error).
- Added `Pim.sln` (referencing both `Api` and `Api.Tests`) since without it `dotnet build`/`dotnet test` couldn't run from the repo root (`MSB1003: Specify a project or solution file`). Updated `CLAUDE.md` commands section to reflect the solution file, `dotnet test`, and the other conventions (`TreatWarningsAsErrors`, Mongo dependency) that had drifted since it was last written.
- Verified: `dotnet build` and `dotnet test` both run cleanly from the repo root via `Pim.sln` (0 warnings / 0 errors).

## Prompt Log

1. "create worklog for UBE-6"
2. "start the worklog"
