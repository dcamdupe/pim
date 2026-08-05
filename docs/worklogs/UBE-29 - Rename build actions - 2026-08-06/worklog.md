# UBE-29: Rename build actions

Linear: https://linear.app/uberconcept/issue/UBE-29/rename-build-actions
Status: In Progress · Priority: No priority

## Description (from Linear)

Add a clear prefix on what the purpose of the action is:

* .Net → Build Api
* FrontEnd → Build Front end
* Terraform → Deploy Terraform
* Deploy → Deploy platform

## Current state

Four GitHub Actions workflows in `.github/workflows/`, each with a top-level `name:` that's what
shows up in the Actions tab/PR checks list - this is exactly what the ticket's list maps:

- `dotnet.yml` - `name: .NET`
- `frontend.yml` - `name: FrontEnd`
- `terraform.yml` - `name: Terraform`
- `deploy.yml` - `name: Deploy`

Grepped the repo for any docs referencing these by display name (not just by filename/path) -
`Terraform/README.md` and `Terraform/modules/api/main.tf` reference `terraform.yml`/`deploy.yml` by
file path only, which isn't changing, so nothing else needs updating alongside the 4 workflow files.
Job-level `name:` fields inside each workflow (`Build`, `Unit test`, `Lint`, `Plan`, `Apply`,
`Deploy API`, `Deploy FrontEnd`) aren't mentioned in the ticket and are left as-is - the ticket's list
maps 1:1 to the 4 workflow files/top-level names, not the jobs within them.

## Plan

1. `.github/workflows/dotnet.yml` - `name: .NET` → `name: Build Api`
2. `.github/workflows/frontend.yml` - `name: FrontEnd` → `name: Build Front end`
3. `.github/workflows/terraform.yml` - `name: Terraform` → `name: Deploy Terraform`
4. `.github/workflows/deploy.yml` - `name: Deploy` → `name: Deploy platform`
5. Verification: this only changes what's shown in the Actions UI, not any behavior - confirm each
   YAML file is still valid (`terraform.yml`/`deploy.yml` can't be exercised without real AWS
   credentials/manual dispatch, so this is a syntax check, not a run) and that `dotnet test`/
   `FrontEnd.UnitTests` still pass unaffected (sanity check only, no code touched).

## Checklist

- [ ] `dotnet.yml` renamed to "Build Api"
- [ ] `frontend.yml` renamed to "Build Front end"
- [ ] `terraform.yml` renamed to "Deploy Terraform"
- [ ] `deploy.yml` renamed to "Deploy platform"
- [ ] YAML validity + sanity test pass

## Prompt log

- "start a worklog on UBE-29"
