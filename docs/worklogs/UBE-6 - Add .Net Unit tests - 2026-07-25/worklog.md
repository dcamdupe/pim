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

- [ ] Create `Api.Tests` xUnit project
- [ ] Reference `Api` from `Api.Tests`
- [ ] Verify `dotnet test` runs (0 tests, no errors)
- [ ] Decide on / add a `.sln` if needed

## Prompt Log

1. "create worklog for UBE-6"
