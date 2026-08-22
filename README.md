# PIM for David Cameron

This creates a Personal Financial Manager specifically for one user.

# Running on local

- Install Docker
- Install node
- Install dotnet
- Run `source scripts/setup_local.sh` (must be *sourced*, not executed directly, so `ASPNETCORE_ENVIRONMENT=Local` persists in your shell) to start (or reuse) a local DynamoDB Local emulator container, create its `User` table if needed, seed a test login, copy `FrontEnd/.env.local` to `FrontEnd/.env`, and set `ASPNETCORE_ENVIRONMENT=Local` for the Api (requires `docker`, `aws`, `jq`, and `htpasswd` on `PATH`; safe to re-run - skips table creation/the login insert if they already exist, always overwrites `FrontEnd/.env`)

## Starting the app

- Run `scripts/run_local.sh` to build and start both the API and the front end together in one
  terminal - kills anything already bound to their ports first, so it's always safe to re-run;
  `Ctrl+C` stops both. Requires `source scripts/setup_local.sh` already done at least once (see
  above).
- To run just one piece on its own, see the sections below.

## Running the API

- `cd Api && dotnet run`
- Accessible at http://localhost:5037 (or https://localhost:7010)

## Running the front end

- `cd FrontEnd && npm install && npm run dev`
- Accessible at http://localhost:5173
- Requires `FrontEnd/.env` (see `scripts/setup_local.sh` above) providing `VITE_API_BASE_URL`; `FrontEnd/.env.production` is used automatically for production builds (`npm run build`)

## Running in VS Code

- Open the Run and Debug panel and select **Api + FrontEnd** to start both the API and the front end together

## Test login

- Email: `testuser@example.com`
- Password: `TestPassword123!`

# Deploying to AWS

Production runs on AWS (VPC, CloudFront + S3, DynamoDB, Lambda + API Gateway), provisioned via
Terraform - see `Terraform/README.md` for full details. Setting this up from scratch in a new AWS
account, in order:

1. AWS credentials for a human to run Terraform locally with (**never root account credentials**
   for day-to-day use).
2. Bootstrap the remote state S3 bucket (`Terraform/bootstrap`).
3. `terraform apply` the main config for the first time - creates the VPC, CloudFront/S3 frontend,
   DynamoDB table, and Lambda + API Gateway.
4. ACM certificates for the custom domains, requested and DNS-validated by hand in the ACM console
   (not Terraform-managed).
5. DNS records pointed at the Terraform outputs.
6. An OIDC identity provider + IAM role created by hand in the AWS Console, so GitHub Actions can
   run `terraform.yml`/`deploy.yml` without long-lived credentials.

See `Terraform/README.md` for the exact steps for each.