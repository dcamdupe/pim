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

variable "vpc_cidr" {
  description = "CIDR block for this environment's VPC. No default - set explicitly per environment (in environments/<name>.tfvars) so environments never collide if they're ever peered/connected."
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
