# UBE-31 — Switch to proper dns

Linear: https://linear.app/uberconcept/issue/UBE-31/switch-to-proper-dns

## Description

- Allocate cert - done in ACM - certificate id: **e5a0f0ac-638e-435e-9d4c-43c8ca2fc737**
  - Add as an input variable
- Create dns - will do manually
- set front end to pim.uberconcept.com
- set api to pim-api.uberconcept.com
- update api url

## Clarifications (resolved before implementation)

- **Cert region split:** confirmed two separate certs already exist (manually created in ACM, same pattern as the ticket's "done in ACM"/"DNS done manually" approach) - no Terraform-provisioned cert needed:
  - CloudFront (must be us-east-1): `arn:aws:acm:us-east-1:274755208687:certificate/56304fcf-9941-4aa4-aea9-d52846c36dcc`
  - API Gateway custom domain (must be regional, `ap-southeast-2`): `arn:aws:acm:ap-southeast-2:274755208687:certificate/2edef78d-5b5c-444d-a81f-f41203a9a3fd`
- **Domain names as variables (my call, low-stakes):** making `pim.uberconcept.com`/`pim-api.uberconcept.com` input variables too, not just the certs - consistent with `var.application`/`var.environment`, and set in `environments/production.tfvars` alongside the cert ARNs (ARNs aren't secret, fine to commit).

## Plan

1. **`Terraform/variables.tf`** (root) — add `frontend_domain_name`, `frontend_certificate_arn`, `api_domain_name`, `api_certificate_arn` (no defaults, set per environment).
2. **`Terraform/environments/production.tfvars`** — set the four new variables to the values above.
3. **`Terraform/main.tf`** — pass the new variables through to `module.frontend`/`module.api`.
4. **`Terraform/modules/frontend`**: add `domain_name`/`certificate_arn` variables; update `aws_cloudfront_distribution.frontend` - `aliases = [var.domain_name]`, replace `viewer_certificate { cloudfront_default_certificate = true }` with `acm_certificate_arn`/`ssl_support_method = "sni-only"`/`minimum_protocol_version = "TLSv1.2_2021"` (also fixes the old default-cert's forced-TLSv1.0-minimum, flagged in an earlier security review).
5. **`Terraform/modules/api`**: add `domain_name`/`certificate_arn` variables; add `aws_apigatewayv2_domain_name` (REGIONAL endpoint, `TLS_1_2` security policy) + `aws_apigatewayv2_api_mapping` linking it to the existing default stage.
6. **Outputs**: `modules/api/outputs.tf` — add the custom domain's `target_domain_name` (what the manual DNS CNAME points at); re-expose at root (`Terraform/outputs.tf`) alongside the existing `frontend_cloudfront_domain_name`.
7. **`FrontEnd/.env.production`** — `VITE_API_BASE_URL` → `https://pim-api.uberconcept.com` (replacing the temporary `execute-api` URL).
8. **`Terraform/README.md`** — document the manual DNS records needed (CNAME/ALIAS for both domains, targets from the outputs above) and that both certs are manually managed in ACM, not Terraform-provisioned.
9. Verify: `terraform fmt`/`validate`, and confirm the FrontEnd build embeds the new API URL.

## Checklist

- [x] `Terraform/variables.tf` — four new domain/cert variables
- [x] `Terraform/environments/production.tfvars` — set the four values
- [x] `Terraform/main.tf` — pass through to modules
- [x] `modules/frontend` — `aliases` + real `viewer_certificate`
- [x] `modules/api` — `aws_apigatewayv2_domain_name` + `aws_apigatewayv2_api_mapping`
- [x] Outputs — API custom domain target, re-exposed at root
- [x] `FrontEnd/.env.production` — update `VITE_API_BASE_URL`
- [x] `Terraform/README.md` — document manual DNS + cert management
- [x] Verify: `terraform fmt`/`validate`, FrontEnd build embeds new URL — both pass; confirmed `https://pim-api.uberconcept.com` is embedded in the built assets

## Prompt Log

1. "start worklog for UBE-31"
2. "I've recreated the certificate in us-east-1, new ARN is: arn:aws:acm:us-east-1:274755208687:certificate/56304fcf-9941-4aa4-aea9-d52846c36dcc"
3. "what is required to replicate this certificate to another region?"
4. "cert for ap-southeast-2 is arn:aws:acm:ap-southeast-2:274755208687:certificate/2edef78d-5b5c-444d-a81f-f41203a9a3fd"
