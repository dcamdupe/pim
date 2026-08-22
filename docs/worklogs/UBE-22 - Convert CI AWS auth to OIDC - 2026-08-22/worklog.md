# UBE-22: Convert the github AWS auth to use OIDC

## Linear issue

[UBE-22](https://linear.app/uberconcept/issue/UBE-22/convert-the-github-aws-auth-to-use-oidc) — Convert the github AWS auth to use OIDC

(No description on the issue - title only.)

## Note on prior guidance

OIDC was explicitly rejected for this repo's CI AWS auth on 2026-07-26 - the same day this ticket
was created - in favour of static `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` secrets for a
manually-created IAM user. UBE-22 reverses that; confirmed with the user before starting that this
is intentional (memory updated accordingly).

## Description

Two GitHub Actions workflows currently authenticate to AWS with static long-lived access keys via
`aws-actions/configure-aws-credentials@v4`:
- `.github/workflows/terraform.yml` (`plan`, `apply` jobs) - Terraform plan/apply against real AWS.
- `.github/workflows/deploy.yml` (`deploy-api`, `deploy-frontend` jobs) - Lambda code update + S3
  sync + CloudFront invalidation. Explicitly documented as reusing the same secrets as
  `terraform.yml`.

Both are `workflow_dispatch`-only (manual, never on push), consistent with the project's existing
"one person, applies done serially" model.

The CI IAM user's permissions were created manually in the AWS console, not Terraform - and per
the user, it currently has the `AdministratorAccess` managed policy attached (not a hand-crafted
least-privilege policy, despite the README's aspirational wording). So the new OIDC role will
attach that same managed policy, for a like-for-like swap of the auth *mechanism* only - tightening
permissions is a separate concern, left as a noted follow-up rather than bundled into this.

**Revised after discussion**: initially planned to Terraform-manage the OIDC provider + role in
`Terraform/bootstrap/` (same category as the remote-state S3 bucket). User pushed back: unlike the
state bucket, the OIDC role's whole purpose is letting CI authenticate at all - Terraform-managing
it doesn't remove the manual step (a human still has to run `bootstrap` locally with privileged
credentials first), it just adds a second piece of Terraform state to track and a real risk that
"clean build" docs drift from what's actually needed. That's the same rebuttal that already killed
Terraform-managing the CI IAM policy for the static-key setup (see the superseded memory) - it
applies at least as strongly here. Settled on: create the OIDC provider + role by hand, documented
in `Terraform/README.md`. No new Terraform files at all for this ticket.

User then asked for two more changes: (1) **AWS Console click-steps**, not CLI commands, since this
is a one-time manual setup step better walked through visually; (2) a note in the top-level
`README.md` (not just `Terraform/README.md`) summarising what's required to set the whole thing up
in AWS from scratch, since that currently only documents local dev.

## Plan

- `Terraform/README.md`
  - Replace the "create an IAM user, generate an access key, add repo secrets" instructions with
    numbered AWS Console steps: IAM → Identity providers → Add provider (OpenID Connect,
    `https://token.actions.githubusercontent.com`, audience `sts.amazonaws.com`), then IAM → Roles
    → Create role (Web identity trust type, GitHub organization/repository/branch fields scoped to
    `dcamdupe`/`pim`/`main` - the console writes these into the trust policy for you), attach
    `AdministratorAccess` (matches the current IAM user's real permissions, no scope change), copy
    the role ARN into the `AWS_ROLE_ARN` repo **variable** (not secret).
  - Note as a manual follow-up: once verified working, remove the now-unused
    `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` repo secrets and the old IAM user.
- `README.md` (root)
  - New "Deploying to AWS" section: a short numbered overview of what's required to stand this up
    in a new AWS account from scratch (Terraform credentials → bootstrap state bucket → first
    `apply` → ACM certs → DNS → the OIDC provider/role for CI), pointing at `Terraform/README.md`
    for the full detail of each step rather than duplicating it.
- `.github/workflows/terraform.yml` and `.github/workflows/deploy.yml`
  - Add `permissions: id-token: write` (alongside the existing `contents: read`) to each job that
    talks to AWS.
  - Replace `aws-access-key-id`/`aws-secret-access-key` inputs on every
    `aws-actions/configure-aws-credentials@v4` step with `role-to-assume: ${{ vars.AWS_ROLE_ARN }}`.
- Verification scope: this ticket touches no Terraform code, only workflow YAML + docs. No AWS
  credentials in this environment either way - the actual OIDC provider/role creation and
  `AWS_ROLE_ARN` repo variable are manual steps for the user to run once, following the README.

## Checklist

- [x] Update `Terraform/README.md`'s CI-auth instructions with AWS Console click-steps
- [x] Add a "Deploying to AWS" overview section to the root `README.md`
- [x] Update `terraform.yml` and `deploy.yml` to use `role-to-assume` + `id-token: write`
- [x] Validate workflow YAML
- [ ] Review diff and open PR

## Session log

### 2026-08-22

- Retrieved UBE-22 from Linear - title only, no description. Flagged the conflict with the
  2026-07-26 "OIDC rejected, use static keys" decision (same day this ticket was created) and
  confirmed with the user before proceeding. Updated the corresponding memory to note it's
  superseded.
- Read `terraform.yml`, `deploy.yml`, `Terraform/bootstrap/main.tf`, and `Terraform/README.md` to
  confirm the current static-key setup: two workflows, four `configure-aws-credentials` steps,
  sharing one manually-created IAM user's secrets.
- Asked how to source the IAM policy for the new role, since the CI user's permissions were never
  Terraform-managed - user clarified it currently has `AdministratorAccess` attached, so the new
  role will match that exactly rather than attempting to reverse-engineer a least-privilege policy
  as part of this ticket.
- Created this worklog and branch `UBE-22/convert-the-github-aws-auth-to-use-oidc` off `main`.
- User pushed back on the initial plan (OIDC provider/role in `Terraform/bootstrap/`): it doesn't
  remove the manual step and echoes the exact "clean build" chicken-and-egg problem the original
  static-key decision already rejected Terraform-managing for. Revised to: create the OIDC
  provider/role by hand, documented in `Terraform/README.md`, no new Terraform files. Updated
  `feedback_ci_aws_auth.md` memory to capture the reconfirmed "never Terraform-manage the CI auth
  identity" principle, now generalised beyond just the old static-key case.
- User asked for AWS Console click-steps instead of CLI commands, plus a root `README.md` note on
  what's required to set this up in AWS from scratch. Rewrote `Terraform/README.md`'s "Applying via
  GitHub Actions" section as numbered Console steps (Identity providers → Add provider, then Roles
  → Create role with the GitHub org/repo/branch fields), and added a "Deploying to AWS" overview
  section to the root `README.md` pointing at `Terraform/README.md` for detail.
- Updated `terraform.yml` and `deploy.yml`: `permissions.id-token: write` added, all four
  `configure-aws-credentials` steps switched from `aws-access-key-id`/`aws-secret-access-key` to
  `role-to-assume: ${{ vars.AWS_ROLE_ARN }}`. Both workflow files validated with Ruby's YAML parser.
- User flagged the README as too short on info and asked directly "how do I set up the OIDC role
  in AWS?" / "how do I configure this in GitHub?" - answered both in full in chat, then expanded
  `Terraform/README.md`'s section into clearly separated, more granular numbered subsections ("In
  the AWS Console: create the OIDC identity provider" / "...create the IAM role" / "In GitHub: add
  the role ARN as a repo variable" / cleanup), matching the level of detail given in chat rather
  than the terser original bullets.
- Remaining: review the diff and open the PR.
