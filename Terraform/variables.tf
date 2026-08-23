variable "aws_region" {
  description = "AWS region for all resources."
  type        = string
  default     = "ap-southeast-2"
}

variable "application" {
  description = "Application name, used for tagging and resource naming."
  type        = string
  default     = "pim"
}

variable "environment" {
  description = "Deployment environment name (e.g. production). No default - always set explicitly via the matching environments/<name>.tfvars file, alongside the matching Terraform workspace."
  type        = string
}

variable "frontend_domain_name" {
  description = "Custom domain for the FrontEnd CloudFront distribution (e.g. pim.uberconcept.com)."
  type        = string
}

variable "frontend_certificate_arn" {
  description = "ACM certificate ARN for the FrontEnd custom domain. Must be in us-east-1 - a hard CloudFront requirement, regardless of aws_region. Manually requested/validated in ACM, not Terraform-provisioned."
  type        = string
}

variable "api_domain_name" {
  description = "Custom domain for the API Gateway (e.g. pim-api.uberconcept.com)."
  type        = string
}

variable "api_certificate_arn" {
  description = "ACM certificate ARN for the API custom domain. Must be a regional cert in aws_region - API Gateway v2 custom domains don't support edge-optimized certs. Manually requested/validated in ACM, not Terraform-provisioned."
  type        = string
}

variable "cognito_domain_prefix" {
  description = "Prefix for the Cognito Hosted UI domain (<prefix>.auth.<region>.amazoncognito.com). Shared namespace across all AWS accounts using Cognito, so must be globally unique - no default, set explicitly per environment."
  type        = string
}

variable "cognito_allowed_emails" {
  description = "Google account emails allowed to sign in (UBE-39) - enforced by a Cognito pre-sign-up Lambda trigger, not by Google itself. No default - set explicitly per environment."
  type        = list(string)
}

variable "google_client_id" {
  description = "OAuth 2.0 client id from the manually-created Google Cloud OAuth client used to federate Cognito with Google (see docs/worklogs UBE-39). No default - supply via TF_VAR_google_client_id, never a committed tfvars file."
  type        = string
}

variable "google_client_secret" {
  description = "OAuth 2.0 client secret from the manually-created Google Cloud OAuth client. No default - supply via TF_VAR_google_client_secret, never a committed tfvars file."
  type        = string
  sensitive   = true
}
