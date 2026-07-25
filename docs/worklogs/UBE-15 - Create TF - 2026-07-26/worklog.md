# UBE-15 — Create TF

Linear: https://linear.app/uberconcept/issue/UBE-15/create-tf

## Description

- Overall guidance:
  - Input parameters to control key variables: environment, AWS region, VPC IP address range.
  - Tag all resources with: environment, application.
- Shared infrastructure:
  - VPC
  - Private subnets — one per AZ
  - NACLs and Security Groups
- Front end — CloudFront + S3:
  - Configure S3 bucket policy so only CloudFront can read from it.
- DynamoDB table:
  - Key — `userId`
  - Data — JSON
- Backend — API Gateway + Lambda:
  - API Gateway maps all requests through to the Lambda
  - .NET Core
  - 30 second timeout
  - 128MB memory
  - Role with minimal permissions: write logs + access to the user table in DynamoDB

## Clarifications (resolved before implementation)

- **Backend/Api relationship:** the Lambda is meant to eventually run the existing `Api` (ASP.NET Core), but adapting `Api` to a Lambda handler (e.g. `Amazon.Lambda.AspNetCoreServer`) is separate/future work — out of scope here. This ticket provisions the infra (Lambda + API Gateway) only; the deployed code can be a placeholder until that other ticket lands.
- **Lambda networking:** the Lambda **is** attached to the VPC's private subnets. Since it only needs DynamoDB + CloudWatch Logs (not general internet egress), this uses VPC Endpoints rather than a NAT Gateway — a Gateway Endpoint for DynamoDB (free) and an Interface Endpoint for CloudWatch Logs — avoiding NAT Gateway cost/complexity for a need that doesn't exist yet.
- **State backend:** S3 remote state + a DynamoDB lock table.
- **Environments:** only a `production` environment for now (the `environment` variable still exists per the ticket's "input parameters" requirement, so more can be added later without restructuring).
- **Security flag — root AWS credentials:** this machine's AWS CLI is configured with **root account** credentials (account `062432225305`). Using root for Terraform is against AWS best practice (no guardrails if something goes wrong). Per the user, this ticket stays at authoring + `terraform fmt`/`validate` only — no `plan` or `apply` against the real account from this session. Real provisioning should happen later, ideally with a dedicated least-privilege IAM identity instead of root.
- **Region:** `ap-southeast-2`, matching this machine's existing AWS CLI default.
- **API Gateway type:** HTTP API (v2) — cheaper/simpler, matches "proxy everything to one Lambda."
- **Lambda placeholder:** a minimal stub .NET Lambda handler (returns 200 OK) is built/zipped so `terraform apply` (whenever it's actually run, later) has a real artifact to deploy. The Lambda resource uses `lifecycle { ignore_changes = [...] }` on the deployment package so a future CI/CD pipeline can redeploy the real `Api`-based handler without Terraform reverting it.
- **DynamoDB billing / AZ count (my call, not asked — low-stakes defaults):** `PAY_PER_REQUEST` billing (no capacity planning needed for a single-user app), 2 AZs for the private subnets (standard HA minimum), no custom domain for CloudFront/API Gateway (default `*.cloudfront.net`/`execute-api` endpoints).

## Plan

1. New root-level `Terraform/` directory for the IaC, following the repo's existing flat top-level layout (`Api/`, `FrontEnd/`, `scripts/`, etc.).
2. Bootstrap: S3 bucket + DynamoDB lock table for remote state (`Terraform/bootstrap/`, its own local-state config, since state storage can't itself live in the state it's backing). Authored only — not applied, per the root-credentials decision above.
3. Root module structure: `variables.tf` (`environment`, `aws_region`, `vpc_cidr`), `providers.tf`, `backend.tf` (S3 + DynamoDB lock), a consistent tagging mechanism (provider `default_tags`) for `environment`/`application`.
4. Networking module: VPC, one private subnet per AZ (2 AZs), NACLs, Security Groups, plus the DynamoDB Gateway Endpoint and CloudWatch Logs Interface Endpoint (no NAT Gateway).
5. Frontend module: S3 bucket (private) + CloudFront distribution, Origin Access Control so the bucket policy only allows the CloudFront distribution to read.
6. Data module: DynamoDB table (`PAY_PER_REQUEST`), partition key `userId`, a generic `data` attribute for the JSON payload.
7. Backend module: stub Lambda (.NET Core runtime, VPC-attached to the private subnets) + HTTP API Gateway (`$default` route proxying to the Lambda), 30s timeout, 128MB memory, an IAM role scoped to just CloudWatch Logs writes + DynamoDB access limited to the user table.
8. `production.tfvars` for the one environment; run `terraform fmt`/`validate` (no `plan`/`apply` against the real root-credentialed account).
9. Document how to use it (`Terraform/README.md`) and reference it from `CLAUDE.md`.

## Checklist

- [ ] Bootstrap remote state config (S3 bucket + DynamoDB lock table) — authored, not applied
- [ ] Scaffold `Terraform/` layout (variables, providers, backend config, tagging convention)
- [ ] Networking: VPC, private subnets per AZ, NACLs, Security Groups, VPC endpoints (DynamoDB + Logs)
- [ ] Frontend: S3 + CloudFront, bucket policy restricted to CloudFront
- [ ] DynamoDB table (`userId` key + JSON data, on-demand billing)
- [ ] Backend: HTTP API Gateway + Lambda (.NET Core stub, VPC-attached, 30s timeout, 128MB, minimal IAM role)
- [ ] `terraform fmt` / `validate` clean for `production`
- [ ] Document in `Terraform/README.md` + reference from `CLAUDE.md`

## Prompt Log

1. "start a worklog for UBE-15"
2. "is the plan clear?"
3. "1. Yes, the API will be inside this but implemented in another ticket"
4. "2. Yes"
5. "3. S3 backend. Initially only a production environment"
6. "any other questions"
