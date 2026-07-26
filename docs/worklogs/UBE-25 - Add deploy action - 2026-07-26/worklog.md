# UBE-25 — Add deploy action

Linear: https://linear.app/uberconcept/issue/UBE-25/add-deploy-action

## Description

- deploy API
- deploy front end
  - compile
  - copy correct .env file to .env location
  - copy to S3
  - after deployment, invalidate the cloudfront cache

## Clarifications (resolved before implementation)

- **Terraform/deploy conflict:** re-add `lifecycle.ignore_changes = [filename, source_code_hash]` to `aws_lambda_function.api`. Terraform's own `build.zip` is only used to create the function on the very first `apply`; day-to-day code updates go through this deploy action (`aws lambda update-function-code`) instead, matching the original intent noted in the pre-UBE-23 lambda-stub comments.
- **Trigger:** manual (`workflow_dispatch`) only, consistent with `terraform.yml`.
- **AWS credentials:** reuse the same `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` repo secrets already set up for `terraform.yml`.
- **Resource identifiers:** add root Terraform outputs for the S3 bucket name, Lambda function name, and CloudFront distribution ID; store them as GitHub repo **variables** (`FRONTEND_BUCKET_NAME`, `API_LAMBDA_FUNCTION_NAME`, `CLOUDFRONT_DISTRIBUTION_ID`), copied by hand from `terraform output` once after applying - matching the existing manual `backend.tf` bucket-name pattern, no Terraform state access needed from the deploy workflow.

## Plan

1. **Terraform (`modules/api/main.tf`):** re-add `lifecycle { ignore_changes = [filename, source_code_hash] }` to `aws_lambda_function.api`.
2. **Terraform (`outputs.tf`):** add root outputs `frontend_bucket_name` (`module.frontend.bucket_name`), `cloudfront_distribution_id` (`module.frontend.cloudfront_distribution_id`), `api_lambda_function_name` (`module.api.lambda_function_name`).
3. **`.github/workflows/deploy.yml`** (new) — manual `workflow_dispatch`, two independent jobs:
   - `deploy-api`: checkout, `setup-dotnet`, `dotnet publish Api -c Release -r linux-x64 --self-contained false -o build`, zip it, `aws lambda update-function-code --function-name ${{ vars.API_LAMBDA_FUNCTION_NAME }} --zip-file fileb://...`.
   - `deploy-frontend`: checkout, `setup-node` (22), `npm ci`, copy `FrontEnd/.env.production` → `FrontEnd/.env` (mirrors `scripts/setup_local.sh`'s local pattern), `npm run build`, `aws s3 sync FrontEnd/dist s3://${{ vars.FRONTEND_BUCKET_NAME }} --delete`, `aws cloudfront create-invalidation --distribution-id ${{ vars.CLOUDFRONT_DISTRIBUTION_ID }} --paths "/*"`.
4. **`Terraform/README.md`** — document the one-time step of copying the three `terraform output` values into GitHub repo variables.
5. Verify: `terraform fmt`/`validate`, workflow YAML syntax, and (structurally, since this environment has no real AWS credentials/deployed infra to test against) that the `dotnet publish`+zip and `npm run build` steps succeed locally.

## Checklist

- [x] Terraform: re-add `lifecycle.ignore_changes` on `aws_lambda_function.api`
- [x] Terraform: root outputs for bucket name, Lambda function name, CloudFront distribution ID
- [x] `.github/workflows/deploy.yml` — `deploy-api` job
- [x] `.github/workflows/deploy.yml` — `deploy-frontend` job
- [x] `Terraform/README.md` — document the one-time GitHub variables setup
- [x] Verify: `terraform fmt`/`validate`, workflow YAML, local build steps — all pass; confirmed the production build embeds `.env.production`'s API URL after the copy step, matching what `deploy.yml` will do in CI

## Prompt Log

1. "start worklog for UBE-25"
2. "Re-add lifecycle.ignore_changes" / "Manual only (workflow_dispatch)" (clarifying question answers)
3. "Reuse the same secrets" / "GitHub repo variables, set by hand once" (clarifying question answers)
