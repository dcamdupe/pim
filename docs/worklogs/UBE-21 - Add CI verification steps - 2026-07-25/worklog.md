# UBE-21 — Add verification steps into github

Linear: https://linear.app/uberconcept/issue/UBE-21/add-verification-steps-into-github

## Description

- fail the front end build if npm audit fails
- fail the api build if there are critical nuget packages

## Plan

1. Baseline check (done): `npm audit` in `FrontEnd/` currently reports 0 vulnerabilities; `dotnet list Pim.sln package --vulnerable --include-transitive` currently reports no vulnerable packages for any project. Neither check should fail immediately once added.
2. `.github/workflows/frontend.yml`: add an `npm audit` step to the `build` job (`FrontEnd/`, after `npm ci`) — `npm audit`'s default exit code is already non-zero on any detected vulnerability, so no extra scripting is needed to "fail the build". Scoped to `FrontEnd/` only (the app), not `FrontEnd.UnitTests/`, per the ticket's literal "front end build" wording.
3. `.github/workflows/dotnet.yml`: add a step to the `build` job, after `dotnet build`, running `dotnet list Pim.sln package --vulnerable --include-transitive`. Unlike `npm audit`, this command always exits `0` regardless of findings, so the step needs to capture its output and explicitly fail (grep for a `Critical` severity marker) — only critical severity should fail the build, per the ticket.
4. Verify: confirm both new steps pass locally against current (clean) state, push, and confirm the workflows still run green in GitHub Actions.

## Checklist

- [x] Add `npm audit` step to FrontEnd build job
- [x] Add critical-NuGet-vulnerability check step to Api build job
- [x] Verify both workflows run green

## Notes

## Prompt Log

1. "create worklog for UBE-21"
2. "start the checkoist"
3. "there is a better one line command to check for vulnerable npm packages" (re: the NuGet check — clarified via follow-up)
4. "why has the checklist not been updated?"
5. "raise the PR"
6. "testes are green"
