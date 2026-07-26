# Terraform

Infrastructure as code for PIM's AWS deployment: a VPC with private subnets (NACLs, Security
Groups, VPC endpoints), a CloudFront + S3 frontend, a DynamoDB users table, and an HTTP API
Gateway + Lambda backend.

## Layout

```
Terraform/
  bootstrap/            # S3 state bucket. Its own local state - this can't live in the
                         # remote state it creates. No DynamoDB lock table: applies are
                         # done by one person, serially, so there's no locking need.
  modules/
    networking/          # VPC, private subnets (one per AZ), NACLs, Security Groups, VPC endpoints
    frontend/            # S3 + CloudFront (Origin Access Control restricts the bucket to CloudFront)
    data/                # DynamoDB users table (userId key, schemaless JSON `data` attribute)
    api/                 # Lambda (stub handler for now) + HTTP API Gateway + IAM role
  main.tf, variables.tf, providers.tf, backend.tf, outputs.tf   # shared root config
  environments/
    production.tfvars    # the only thing that varies per environment
```

`environment` is a variable, not a template - there's one shared root config, and each
environment is just a `.tfvars` file plus its own Terraform workspace for state isolation.
Adding a new environment later is `environments/<name>.tfvars` + `terraform workspace new <name>`,
no duplicated `.tf` files.

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

## The API Lambda is a placeholder

The Lambda's real code (adapting the `Api` ASP.NET Core project to run as a Lambda handler,
e.g. via `Amazon.Lambda.AspNetCoreServer`) is separate/future work. Until then,
`modules/api/lambda-stub/` is a minimal placeholder handler, and its build output is committed
as `modules/api/lambda-stub/lambda.zip` so `terraform plan`/`apply` (including in CI) has a real
artifact to deploy without needing a .NET toolchain. If `lambda-stub`'s source ever changes,
rebuild and re-commit the zip by hand:

```
cd modules/api/lambda-stub
dotnet publish -c Release -r linux-x64 --self-contained false -o publish
(cd publish && zip -r -X ../lambda.zip .)
```

The Lambda resource ignores future changes to its deployment package/handler
(`lifecycle.ignore_changes`), so a future CI/CD pipeline can redeploy the real handler without
Terraform reverting it.

## Applying via GitHub Actions

Plan and apply are two separate workflows, each triggered manually
(`workflow_dispatch`) - neither ever runs on push, and applying never
happens automatically as a consequence of planning:

- `.github/workflows/terraform-plan.yml` runs `terraform plan` and uploads
  the plan file as a build artifact (`tfplan-<environment>`, kept 3 days).
  It does not apply anything.
- `.github/workflows/terraform-apply.yml` applies a plan from a *specific*
  previous plan run. You pass that run's ID (the number in its Actions run
  URL, e.g. `.../actions/runs/1234567890`) as the `plan_run_id` input, so
  the plan you reviewed is the plan that gets applied, not a freshly
  regenerated one.

To run a change: trigger "Terraform Plan", review its output, then trigger
"Terraform Apply" with that run's ID once you're ready.

One-time setup before either workflow can be used:

- Create a dedicated IAM user for CI (**never root credentials**) with
  least-privilege permissions covering the resources these modules manage
  (VPC/networking, the frontend S3 bucket + CloudFront, the DynamoDB table,
  the Lambda + its execution role, and API Gateway), generate an access key,
  and add it to the repo as the `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`
  secrets.
- Configure the `production` GitHub Environment (repo Settings >
  Environments) with required reviewers, so apply still needs a manual
  approval even though the trigger itself is already manual.
- Make sure `backend.tf`'s bucket placeholder has already been replaced (see
  bootstrap step above).

## Verification scope

This was authored and verified with `terraform fmt`/`validate` only - no `plan`/`apply` has been
run against a real AWS account from this environment (root credentials were configured here; see
the security note above).
