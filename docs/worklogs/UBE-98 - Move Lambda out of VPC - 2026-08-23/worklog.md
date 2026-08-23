# UBE-98: Move the Lambda out of the VPC

## Linear issue

https://linear.app/uberconcept/issue/UBE-98/move-the-lambda-out-of-the-vpc

> There is no reason to maintain this inside the VPC. Reasons:
> * no need to access resources inside a VPC
> * no concerns around egress
> * Still able to restrict inbound
>
> This will reduce the cold starts of the endpoints without reducing security.

## Description

The API Lambda (`modules/api/main.tf`) is currently attached to a private
VPC (`modules/networking/`) that was built solely to host it — a VPC, two
private subnets, a route table, NACL rules, a Lambda security group, and a
DynamoDB gateway endpoint. VPC attachment is what causes the Lambda's cold
starts (ENI setup), and the Lambda doesn't need it: it only talks to
DynamoDB (already reachable over the public AWS API, no VPC required) and
CloudWatch Logs. Inbound is already restricted independently of the VPC/SG,
via `aws_lambda_permission.apigw`'s `source_arn` scoping invocation to this
API Gateway only.

Since nothing else in the Terraform config uses `module.networking`'s
outputs, taking the Lambda out of the VPC means the whole networking module
becomes dead and should be removed, not just the Lambda's `vpc_config`
block.

## Plan

1. `modules/api/main.tf`: remove the `vpc_config` block from
   `aws_lambda_function.api`.
2. `modules/api/main.tf`: swap the IAM policy attachment from
   `AWSLambdaVPCAccessExecutionRole` (ENI permissions, only needed for
   VPC attachment) to `AWSLambdaBasicExecutionRole` (CloudWatch Logs
   writes only).
3. `modules/api/variables.tf`: remove the now-unused `private_subnet_ids`
   and `lambda_security_group_id` variables.
4. Remove `modules/networking/` entirely (VPC, subnets, route table, NACLs,
   Lambda security group, DynamoDB gateway endpoint) — nothing else
   references its outputs.
5. `main.tf`: remove the `module "networking"` block and the
   `private_subnet_ids` / `lambda_security_group_id` args passed into
   `module "api"`.
6. `variables.tf` and `environments/production.tfvars`: remove the
   now-unused `vpc_cidr` variable/value.
7. Update `docs/design/architecture/aws-infrastructure.drawio`/`.svg` (and
   README if it mentions the VPC) so the diagram no longer shows the Lambda
   inside a VPC.
8. Run `terraform fmt -recursive` and `terraform validate` from `Terraform/`
   to confirm the config is still valid (no AWS credentials needed for
   either).
9. `terraform plan`/`apply` need real AWS credentials and aren't run from
   this environment (per `Terraform/README.md`) — left for the user to run
   manually. Applying will **destroy** the VPC/subnets/NACLs/SG/endpoint and
   update the live Lambda in place (drop `vpc_config`, swap IAM policy) —
   this is a production infrastructure change.

## Checklist

- [x] Remove `vpc_config` from `aws_lambda_function.api`
- [x] Swap Lambda IAM policy to `AWSLambdaBasicExecutionRole`
- [x] Remove `private_subnet_ids` / `lambda_security_group_id` vars from api module
- [x] Remove `modules/networking/` module directory
- [x] Remove `module "networking"` block and its wiring from root `main.tf`
- [x] Remove unused `vpc_cidr` variable from root `variables.tf` and `environments/production.tfvars`
- [x] Update AWS infrastructure architecture diagram
- [x] `terraform fmt -recursive` and `terraform validate` pass
- [x] Confirm no other references to removed variables/module remain

## Session log

### Prompt: "start a worklog for UBE-98"

Fetched issue details from Linear, inspected the current Terraform Lambda/VPC
setup (`modules/api/main.tf`, `modules/networking/main.tf`, root `main.tf`/
`variables.tf`, `environments/production.tfvars`) to confirm the networking
module exists only to support this Lambda's VPC attachment, drafted the plan
above, wrote this worklog, and created the branch
`UBE-98/move-lambda-out-of-vpc` off `main`.

### Prompt: "yes, go ahead and implement it"

Implemented the plan: dropped `vpc_config` from `aws_lambda_function.api` and
swapped its IAM policy attachment to `AWSLambdaBasicExecutionRole`; removed
the now-unused `private_subnet_ids`/`lambda_security_group_id` variables from
the api module; deleted `modules/networking/` and its wiring from root
`main.tf`; removed the now-unused `vpc_cidr` variable from root
`variables.tf` and `environments/production.tfvars`. Updated the AWS
infrastructure diagram (`.drawio` + `.svg`) and its README to drop the VPC/
VPC-gateway-endpoint and wire the Lambda straight to DynamoDB. Ran
`terraform fmt -recursive` (no changes needed) and `terraform validate`
(success), and grepped the repo to confirm no leftover references to the
removed variables/module. `terraform plan`/`apply` still need to be run
manually with real AWS credentials, per the worklog's plan.

### Prompt: "Does the new lambda run across 3 AZs?"

Explained that Lambda's execution infrastructure is inherently multi-AZ
regardless of VPC attachment; the old `networking` module's `az_count = 3`
subnets existed only to give the VPC-attached Lambda's ENIs AZ coverage,
which is no longer something this project needs to provision. No file
changes.

### Prompt: "update the diagram to move the S3 bucket to the right of the API gateway, directly about the lambda function."

Moved the S3 bucket box in `aws-infrastructure.drawio`/`.svg` from
x=280,y=140 to x=550,y=140, centering it directly above the Lambda box
(x=560-740) and to the right of API Gateway (x=280-480). Updated the S3
icon position and the CloudFront→S3 connector to route around the new
layout (orthogonal polyline in the `.svg`; `.drawio`'s source/target-based
edge re-routes automatically).

### Prompt: "remove the stupid angle bend to the S3 bucket. Move it to right of cloudfront and above the lambda."

Repositioned the S3 box again, to x=550,y=40 — same row/height-top as
CloudFront (y=40) and still centered above Lambda (x=560-740). This puts
CloudFront and S3 side by side, so the connector between them is now a
single straight horizontal line (`<line>` in the `.svg`) instead of the
three-point elbow polyline the previous layout needed.
