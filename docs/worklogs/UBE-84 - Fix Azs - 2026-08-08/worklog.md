# UBE-84: Fix Azs

Linear: https://linear.app/uberconcept/issue/UBE-84/fix-azs
Status: In Progress · Priority: No priority

## Description (from Linear)

Add a subnet into the private subnet, expand the count to 3. It should always have been 3, bad claude.

## Current state

- `Terraform/modules/networking/variables.tf`'s `az_count` variable defaults to `2` -
  `aws_subnet.private` (`count = var.az_count`) and its route table associations only span 2 AZs.
- Earlier in this session the networking module's public subnet (and its Internet Gateway/route
  table) were removed, along with the whole `modules/downloader` Terraform module - the downloader
  now deploys as a Docker container to a Raspberry Pi instead of ECS/Fargate, so that public subnet
  (which existed solely for that task) is gone. The Linear ticket's description was edited down to
  drop the "add 2 public subnets for the ECS task" part accordingly - this ticket is now scoped
  purely to the private subnets' AZ count.

## Plan

1. `Terraform/modules/networking/variables.tf` - change `az_count` default from `2` to `3`.
2. `terraform fmt`/`terraform validate` (no `plan`/`apply` - no AWS credentials configured in this
   environment, consistent with existing project convention of applies being run manually).

## Checklist

- [x] `variables.tf` - `az_count` default 2 → 3
- [x] `terraform fmt`/`terraform validate` - both clean

## Prompt log

- "start a worklog for UBE-84"
- "go ahead"
