variable "application" {
  description = "Application name, used for tagging and resource naming."
  type        = string
}

variable "environment" {
  description = "Deployment environment (e.g. production), used for tagging and resource naming."
  type        = string
}

variable "frontend_domain_name" {
  description = "FrontEnd custom domain (e.g. pim.uberconcept.com) - used to build the Hosted UI's callback/logout URLs."
  type        = string
}

variable "domain_prefix" {
  description = "Prefix for the Cognito Hosted UI domain (<prefix>.auth.<region>.amazoncognito.com). Shared namespace across all AWS accounts using Cognito, so must be globally unique - set explicitly per environment."
  type        = string
}

variable "allowed_emails" {
  description = "Google account emails allowed to sign in, enforced by the pre-sign-up Lambda trigger (see lambda/pre_signup.js). Not secret - just an access allow-list for a personal single-user app."
  type        = list(string)
}

variable "google_client_id" {
  description = "OAuth 2.0 client id from the manually-created Google Cloud OAuth client (see docs/worklogs UBE-39 for setup steps). Supply via TF_VAR_google_client_id, not a committed tfvars file."
  type        = string
}

variable "google_client_secret" {
  description = "OAuth 2.0 client secret from the manually-created Google Cloud OAuth client. Supply via TF_VAR_google_client_secret - never commit this."
  type        = string
  sensitive   = true
}
