# UBE-126: Enable Dependabot

## Linear issue

https://linear.app/uberconcept/issue/UBE-126/enable-dependabot

> Consider whether this replaces the library check

## Description

Dependabot is not set up on `dcamdupe/pim`: there is no `.github/dependabot.yml`, and vulnerability
alerts and security updates are both disabled. This work turns it on for every dependency ecosystem
in the repo and decides whether the daily library check (`.github/workflows/library-check.yml`) is
still needed.

Ecosystems found in the repo:

| Ecosystem | Directories |
| --- | --- |
| npm | `/FrontEnd`, `/FrontEnd.UnitTests`, `/FunctionalTests`, `/FileDownloader` |
| NuGet | `/Api`, `/Api.UnitTests`, `/Api.IntegrationTests` |
| Terraform | `/Terraform`, `/Terraform/bootstrap` |
| GitHub Actions | `/` |

`iosApp` has no tracked `Package.resolved`, so it is left out.

## Library check decision

Decision: remove the npm job, and keep the NuGet job.

- npm: all four projects have lock files, so Dependabot should see transitive packages, and alerts
  overlap the npm job. Dismissing an alert can replace the allowlist for the daily check.
- NuGet: the repo has no `packages.lock.json`, so Dependabot may only see the direct packages in each
  `.csproj`. `dotnet list package --vulnerable --include-transitive` resolves the full tree.
- `frontend.yml` still runs `scripts/npm_audit.sh` on FrontEnd pushes and PRs either way.

## Plan

1. Add `.github/dependabot.yml` covering the ecosystems above, on a weekly schedule, grouping minor
   and patch updates per ecosystem to limit PR volume.
2. Enable vulnerability alerts and automated security updates in the repo settings using `gh api`.
3. Remove the npm job from `library-check.yml`, keep the NuGet job, and record the reasoning in this
   worklog.
4. Add a short note on Dependabot to `CLAUDE.md` if it is useful for future work.
5. After merge, confirm that Dependabot parses the config and runs for each ecosystem.

## Checklist

- [x] Retrieve issue details from Linear
- [x] Create branch `UBE-126/enable-dependabot` off `main`
- [x] Create worklog
- [x] Confirm plan
- [x] Add `.github/dependabot.yml`
- [x] Enable vulnerability alerts in repo settings
- [x] Enable automated security updates in repo settings
- [x] Confirm library check decision
- [x] Remove the npm job from `library-check.yml`
- [x] Commit and open PR (after approval)
- [ ] Verify Dependabot runs after merge

## Session log

### Prompt 1

> start a worklog for UBE-126

### Response 1

Retrieved the issue from Linear, checked the repo's dependency manifests and Dependabot settings,
created branch `UBE-126/enable-dependabot` off `main`, and created this worklog. Waiting for
confirmation of the plan before starting work.

### Prompt 2

> Why not daily updates?

### Response 2

Weekly was chosen to limit PR and CI volume for a single maintainer. Security updates do not follow
the schedule, so daily would only speed up routine version bumps. Daily remains an easy option if
preferred. Waiting for a decision on the schedule and confirmation of the plan.

### Prompt 3

> weekly is fine, go ahead

### Response 3

Added `.github/dependabot.yml` with a weekly schedule. It parses as YAML and every listed directory
exists. Enabled vulnerability alerts and automated security updates, and confirmed both through the
GitHub API. No `CLAUDE.md` note was added, as the config is self-explanatory.

Not verified: a follow-up command to validate the config against the Dependabot JSON schema and list
new alerts and PRs was denied by the permission check, so neither was done. Commit and PR are waiting
for approval.

### Prompt 4

> why does this not replace the library check?

### Response 4

The original reasons were weak: no branch protection means the check blocks nothing, and it cannot
fix an unpatched advisory either. Dependabot can largely replace the npm job. The NuGet job is worth
keeping because the repo has no NuGet lock files, so Dependabot may miss transitive packages. This
NuGet limitation is from memory of GitHub's behaviour and was not tested here. Waiting for a decision.

### Prompt 5

> remove the npm checks

### Response 5

Removed the npm job from `library-check.yml` and kept the NuGet job. The audit step in `frontend.yml`
was left in place. Commit and PR are waiting for approval.

### Prompt 6

> commt and raise the PR

### Response 6

Committed the Dependabot config, the `library-check.yml` change and this worklog to
`UBE-126/enable-dependabot`, and opened a PR. Dependabot still needs verifying after merge.
