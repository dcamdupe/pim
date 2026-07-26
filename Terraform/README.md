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

One-time setup before the workflow can be used:

- Create a dedicated IAM user for CI (**never root credentials**) with
  least-privilege permissions covering the resources these modules manage
  (VPC/networking, the frontend S3 bucket + CloudFront, the DynamoDB table,
  the Lambda + its execution role, and API Gateway), generate an access key,
  and add it to the repo as the `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`
  secrets.
- Make sure `backend.tf`'s bucket placeholder has already been replaced (see
  bootstrap step above).

## Verification scope

This was authored and verified with `terraform fmt`/`validate` only - no `plan`/`apply` has been
run against a real AWS account from this environment (root credentials were configured here; see
the security note above).
