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
`modules/api/lambda-stub/` is a minimal placeholder handler so `terraform apply` has a real
artifact to deploy. Publish it before planning/applying:

```
cd modules/api/lambda-stub
dotnet publish -c Release -r linux-x64 --self-contained false -o publish
```

The Lambda resource ignores future changes to its deployment package/handler
(`lifecycle.ignore_changes`), so a future CI/CD pipeline can redeploy the real handler without
Terraform reverting it.

## Verification scope

This was authored and verified with `terraform fmt`/`validate` only - no `plan`/`apply` has been
run against a real AWS account from this environment (root credentials were configured here; see
the security note above).
