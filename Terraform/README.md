# Terraform

Infrastructure as code for PIM's AWS deployment: a VPC with private subnets (NACLs, Security
Groups, VPC endpoints), a CloudFront + S3 frontend, a DynamoDB users table, and an HTTP API
Gateway + Lambda backend.

The `FileDownloader` Westpac export job no longer runs on AWS - it's deployed as a Docker
container to a Raspberry Pi instead (see `FileDownloader/build-and-deploy-pi.sh`), so this
Terraform doesn't manage it.

## Layout

```
Terraform/
  bootstrap/            # S3 state bucket. Its own local state - this can't live in the
                         # remote state it creates. No DynamoDB lock table: applies are
                         # done by one person, serially, so there's no locking need.
  modules/
    networking/          # VPC, private subnets (one per AZ), NACLs, Security Groups, VPC endpoints
    frontend/            # S3 + CloudFront (Origin Access Control restricts the bucket to CloudFront)
    data/                # DynamoDB table (id key, schemaless JSON `data` attribute)
    api/                 # Lambda (real Api project) + HTTP API Gateway + IAM role
  main.tf, variables.tf, providers.tf, backend.tf, outputs.tf   # shared root config
  environments/
    production.tfvars    # the only thing that varies per environment
```

`environment` is a variable, not a template - there's one shared root config, and each
environment is just a `.tfvars` file plus its own Terraform workspace for state isolation.
Adding a new environment later is `environments/<name>.tfvars` + `terraform workspace new <name>`,
no duplicated `.tf` files.

Each environment is provisioned in its own separate AWS account (not a shared account with
multiple environments in it). That means account-scoped resources - e.g. DynamoDB table names,
which only need to be unique per account+region - don't need `environment` baked into their name
to avoid collisions; there's nothing else in the account for them to collide with.

## Prerequisites

- Terraform (`brew install hashicorp/tap/terraform` - the `terraform` formula was pulled from
  Homebrew core, use HashiCorp's own tap).
- AWS credentials. **Do not use root account credentials** - create a dedicated IAM user/role
  with least-privilege permissions for Terraform before running `plan`/`apply` against a real
  account.

## First-time setup: bootstrap remote state

```
cd bootstrap
terraform init
terraform apply
```

Note the `state_bucket_name` output and paste it into the `bucket` field in `../backend.tf`
(replacing the `<AWS_ACCOUNT_ID>` placeholder).

## Using an environment

```
cd Terraform
terraform init
terraform workspace new production   # first time only; `select` thereafter
terraform plan  -var-file=environments/production.tfvars
terraform apply -var-file=environments/production.tfvars
```

## The API Lambda runs the real Api project

The `Api` ASP.NET Core project runs as the Lambda handler directly, via
`Amazon.Lambda.AspNetCoreServer.Hosting`'s `AddAWSLambdaHosting` - no separate handler
class/project needed, and the same build runs locally via Kestrel or in Lambda (auto-detected).

`modules/api/main.tf` reads the deployment package from `modules/api/build/` (gitignored, not
committed - unlike the old lambda-stub placeholder, this changes on every code change, so it's
published fresh before each `plan`/`apply` rather than hand-committed). Run this from the **repo
root** (not from inside `Terraform/`):

```
dotnet publish Api -c Release -r linux-x64 --self-contained false -o Terraform/modules/api/build
```

`.github/workflows/terraform.yml` does this automatically before `terraform plan`/`apply`; do the
same by hand for a local `plan`/`apply`.

`aws_lambda_function.api` has `lifecycle.ignore_changes` on its deployment package, though - this
build is only actually deployed by the very first `apply` that creates the function. Day-to-day
code updates after that go through `.github/workflows/deploy.yml` instead (see "Deploying the
app" below), so Terraform doesn't fight over the Lambda's code on every apply.

## Applying via GitHub Actions

`.github/workflows/terraform.yml` is a single, manually-triggered
(`workflow_dispatch`) workflow - it never runs on push. Choose the
`action` input: `plan` just runs `terraform plan` and stops there; `apply`
runs `plan` then, in the *same* run, applies exactly that plan (no copying
run IDs between separate workflows).

There's no environment/required-reviewers gate on top of that - GitHub
only offers that for private repos on a paid plan. The deliberate
`action: apply` choice at trigger time is the only gate, which matches
this project's existing "one person, applies done serially" model (see
`backend.tf`/`bootstrap/main.tf`'s notes on skipping state locking for the
same reason).

Authenticates to AWS via OIDC federation (`role-to-assume`), not long-lived access keys - no
secrets to rotate or leak. The OIDC provider and IAM role are created by hand in the AWS Console
(**never root credentials**), not by Terraform: unlike the resources these modules manage, this
role's whole purpose is letting CI authenticate at all, so Terraform-managing it wouldn't remove
the manual step - a human still has to create it first either way, and it would just be a second
piece of state to keep in sync. One-time setup before the workflow can be used:

### 1. In the AWS Console: create the OIDC identity provider

Sign in with an IAM user/role that has IAM admin permissions (not root).

- Search **IAM** in the top search bar to open the IAM service.
- Left sidebar, under **Access management** → **Identity providers**.
- Check whether `token.actions.githubusercontent.com` is already listed - AWS allows only one
  provider per URL per account, and it's shared across every role/repo that uses it. If it's
  already there, skip to step 2.
- Otherwise, **Add provider**:
  - Provider type: **OpenID Connect**
  - Provider URL: `https://token.actions.githubusercontent.com`, then click **Get thumbprint**
    (AWS fetches and verifies GitHub's certificate automatically)
  - Audience: `sts.amazonaws.com`
  - **Add provider**

### 2. In the AWS Console: create the IAM role

- Left sidebar → **Roles** → **Create role**.
- Trusted entity type: **Web identity**.
- Identity provider: the `token.actions.githubusercontent.com` provider from step 1.
- Audience: `sts.amazonaws.com`.
- AWS then shows GitHub-specific fields - fill in:
  - GitHub organization: `dcamdupe`
  - GitHub repository: `pim`
  - GitHub branch: `main`

  These get written into the role's trust policy as a condition on the OIDC token's `sub` claim,
  so only a workflow run against this exact repo+branch can assume the role (matches the "one
  person, applies done serially, the deliberate trigger is the only gate" model used elsewhere in
  this project).
- **Next** → on the **Add permissions** page, search for `AdministratorAccess`, check it →
  **Next** (this matches what the CI identity has always had - tightening it to least-privilege is
  a separate, not-yet-done concern).
- Role name: e.g. `pim-github-actions` → optionally a description → **Create role**.
- Open the new role (its summary page, or IAM → Roles → search the name), and copy its **ARN**
  from near the top - it looks like `arn:aws:iam::<account-id>:role/pim-github-actions`.

### 3. In GitHub: add the role ARN as a repo variable

- On `github.com/dcamdupe/pim`, go to **Settings** (repo settings - needs admin access on the
  repo, not just write access).
- Left sidebar → **Secrets and variables** → **Actions**.
- Click the **Variables** tab (not **Secrets** - the ARN isn't sensitive; the trust policy from
  step 2 is what actually gates access, same reasoning as `FRONTEND_BUCKET_NAME` etc. already
  being variables, not secrets).
- **New repository variable** → name `AWS_ROLE_ARN` → value: the ARN copied in step 2 → **Add
  variable**.

No other GitHub-side configuration is needed - both workflows already reference
`${{ vars.AWS_ROLE_ARN }}` and have `permissions: id-token: write` set.

### 4. Make sure the state bucket already exists

`backend.tf`'s bucket placeholder needs to already be replaced (see the bootstrap step above) -
this is unrelated to OIDC, but `terraform init` fails without it either way.

### Cleaning up the old static-key setup

Once a real `terraform.yml`/`deploy.yml` run has been verified working with the new role, remove
what's no longer used:
- The `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` repo secrets (Settings → Secrets and
  variables → Actions → **Secrets** tab).
- The IAM user they belonged to (IAM → **Users** in the AWS Console).

## Custom domains

`pim.uberconcept.com` (FrontEnd) and `pim-api.uberconcept.com` (API) are set via
`frontend_domain_name`/`api_domain_name` in `environments/production.tfvars`, each with its own
ACM certificate ARN (`frontend_certificate_arn`/`api_certificate_arn`). Both certs are requested
and DNS-validated by hand in the ACM console, same as the rest of DNS for this project (see
below) - Terraform only references their ARNs, it doesn't provision them.

The two certs **must** be in different regions, and can't be reused across the two services:

- CloudFront (`frontend_certificate_arn`) needs a cert in **us-east-1** - a hard requirement
  regardless of `aws_region`.
- The API Gateway custom domain (`api_certificate_arn`) needs a **regional** cert in `aws_region` -
  HTTP APIs (`apigatewayv2`) don't support edge-optimized custom domains at all.

There's no way to "copy" one ACM certificate into the other region - ACM doesn't let you export
the private key for its own issued certificates (unlike `aws acm import-certificate`, which only
works for certs where you already hold the key material yourself). A second cert has to be
requested and DNS-validated from scratch in the other region for the same domain(s).

DNS itself is created by hand, not by Terraform - after `apply`, point your DNS records at:

- `pim.uberconcept.com` → the `frontend_cloudfront_domain_name` output (CNAME/ALIAS)
- `pim-api.uberconcept.com` → the `api_custom_domain_target` output (CNAME/ALIAS)

## Observability (UBE-104)

The API Lambda has **X-Ray active tracing** (`modules/api/main.tf`'s
`tracing_config { mode = "Active" }` + the `AWSXRayDaemonWriteAccess` managed policy). Lambda
emits one trace segment per invocation; see them in the **X-Ray** / **CloudWatch → Application
Signals → Traces** console - request duration over time, cold starts, and error/fault/throttle
rate, with a trace map node for the function.

What it does **not** show, and why:

- **No DynamoDB (or other downstream) subsegments.** That needs an in-process tracer. The AWS
  X-Ray SDK for .NET doesn't support AWS SDK for .NET v4 (which `Pim.Api` uses) and is entering
  maintenance mode; adding downstream spans would mean the ADOT/OpenTelemetry Lambda layer,
  which was ruled out on cost/cold-start grounds. Per-op DynamoDB latency is still logged as
  `elapsedMs` by `DynamoDbRepository` - query it in CloudWatch Logs Insights.
- **No API Gateway segment.** HTTP APIs (`apigatewayv2`) don't support X-Ray; the trace starts
  at the Lambda. The gateway hop is covered by API Gateway's free CloudWatch metrics.

Cost: **$0** at this app's volume - X-Ray's free tier is 100k traces recorded/month, and this is
a single-user app. If volume ever climbs, set a billing alarm; there's no sampling rule
configured (Lambda's default applies).

## Deploying the app

Once the infrastructure exists (first `apply` done), `.github/workflows/deploy.yml` is how the
`Api` Lambda's code and the `FrontEnd`'s static assets actually get updated day-to-day - it's
manually triggered (`workflow_dispatch`) and doesn't touch Terraform at all.

One-time setup, after the first `apply`: run `terraform output` and copy three values into the
repo as **variables** (Settings > Secrets and variables > Actions > Variables tab - not secrets,
these aren't sensitive):

- `FRONTEND_BUCKET_NAME` ← `frontend_bucket_name` output
- `API_LAMBDA_FUNCTION_NAME` ← `api_lambda_function_name` output
- `CLOUDFRONT_DISTRIBUTION_ID` ← `cloudfront_distribution_id` output

It reuses the same `AWS_ROLE_ARN` variable and OIDC role as `terraform.yml` - no separate
credentials needed.

## Verification scope

This was authored and verified with `terraform fmt`/`validate` only - no `plan`/`apply` has been
run against a real AWS account from this environment (root credentials were configured here; see
the security note above).
