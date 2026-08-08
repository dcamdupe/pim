# Terraform

Infrastructure as code for PIM's AWS deployment: a VPC with private subnets (NACLs, Security
Groups, VPC endpoints), a CloudFront + S3 frontend, a DynamoDB users table, an HTTP API
Gateway + Lambda backend, and a scheduled Fargate task (`FileDownloader`) that downloads a
Westpac transaction export and uploads it to the API.

## Layout

```
Terraform/
  bootstrap/            # S3 state bucket. Its own local state - this can't live in the
                         # remote state it creates. No DynamoDB lock table: applies are
                         # done by one person, serially, so there's no locking need.
  modules/
    networking/          # VPC, private subnets (one per AZ) + a single public subnet (for the
                         # downloader task, below), NACLs, Security Groups, VPC endpoints
    frontend/            # S3 + CloudFront (Origin Access Control restricts the bucket to CloudFront)
    data/                # DynamoDB table (id key, schemaless JSON `data` attribute)
    api/                 # Lambda (real Api project) + HTTP API Gateway + IAM role
    downloader/          # ECR repo, ECS cluster + Fargate task def, IAM roles, EventBridge
                         # Scheduler - runs the FileDownloader container daily
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

One-time setup before the workflow can be used:

- Create a dedicated IAM user for CI (**never root credentials**) with
  least-privilege permissions covering the resources these modules manage
  (VPC/networking, the frontend S3 bucket + CloudFront, the DynamoDB table,
  the Lambda + its execution role, and API Gateway), generate an access key,
  and add it to the repo as the `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`
  secrets.
- Make sure `backend.tf`'s bucket placeholder has already been replaced (see
  bootstrap step above).

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

It reuses the same `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` secrets as `terraform.yml` - no
separate credentials needed.

## The downloader (`modules/downloader`)

Runs `FileDownloader`'s Docker image (see `FileDownloader/Dockerfile`) as a scheduled Fargate
task - it downloads a Westpac transaction export and uploads it to the API, once a day.

- **Networking**: unlike the Lambda (private subnets only, no internet access needed), this task
  has to reach the bank's own site, not just AWS services - so it runs in the new public subnet
  (`modules/networking`) with a public IP, egress-only security group, no NAT Gateway. That keeps
  the recurring cost near zero (no NAT Gateway hourly charge) since it's a batch job that runs for
  a couple of minutes once a day, not a listener.
- **Config**: no `.env` is baked into the image - the app code (`FileDownloader/config.ts`) falls
  back to AWS Secrets Manager (secret name `pim_data`, a JSON object shaped like `Config`) whenever
  no `.env` file is present, which is always true inside the container. The task role is granted
  `secretsmanager:GetSecretValue` scoped to that one secret.
- **The `pim_data` secret itself is created by hand**, not by Terraform (`data
  "aws_secretsmanager_secret"` looks it up by name) - same reasoning as the ACM certs below: its
  value is real bank/login credentials that shouldn't pass through tfstate. Its shape is {  "westpacCustomerId": "",  "westpacPassword": "",  "westpacAccount": "",  "pimBaseUrl": "",  "pimLogin": "",  "pimPassword": "",  "pimAccount": ""}
- **Scheduling**: an EventBridge **Scheduler** schedule (`aws_scheduler_schedule`), not a plain
  EventBridge Rule - Scheduler supports `schedule_expression_timezone` (`Australia/Sydney`), so
  "11pm Sydney time" stays correct across the AEST/AEDT daylight-saving transition without the
  cron expression needing manual UTC-offset adjustment twice a year.
- **ECR retention**: a lifecycle policy keeps only the 5 most-recently-pushed images.

### Deploying the downloader

`.github/workflows/downloader-deploy.yml` builds the Docker image, pushes it to ECR, and
registers a new ECS task definition revision - manually triggered, same convention as
`deploy.yml`. `aws_ecs_task_definition.this` has `lifecycle.ignore_changes` on
`container_definitions` for the same reason the API Lambda's deployment package does: this
workflow, not Terraform, is what updates the image day-to-day.

The EventBridge Scheduler target references the task definition **family**, not a pinned
revision - ECS resolves a bare family name to its latest `ACTIVE` revision at run time, so a newly
registered revision takes effect on the next scheduled run automatically, with nothing else to
update.

One-time setup, after the first `apply`: create the `pim_data` secret by hand in Secrets Manager
(see above), then run `terraform output` and copy three values into the repo as **variables**:

- `DOWNLOADER_ECR_REPOSITORY_URL` ← `downloader_ecr_repository_url` output
- `DOWNLOADER_ECS_CLUSTER` ← `downloader_ecs_cluster_name` output
- `DOWNLOADER_TASK_FAMILY` ← `downloader_ecs_task_definition_family` output

It reuses the same `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` secrets as the other deploy
workflows - the CI IAM user needs `ecr:GetAuthorizationToken`/`ecr:BatchCheckLayerAvailability`/
`ecr:PutImage`/`ecr:InitiateLayerUpload`/`ecr:UploadLayerPart`/`ecr:CompleteLayerUpload` on the
downloader ECR repo, plus `ecs:DescribeTaskDefinition`/`ecs:RegisterTaskDefinition` and
`iam:PassRole` on the task/execution roles, added by hand the same way the rest of that user's
permissions are (see "Applying via GitHub Actions" above - its policy isn't Terraform-managed).

## Verification scope

This was authored and verified with `terraform fmt`/`validate` only - no `plan`/`apply` has been
run against a real AWS account from this environment (root credentials were configured here; see
the security note above).
