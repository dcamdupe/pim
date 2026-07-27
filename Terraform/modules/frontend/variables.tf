variable "application" {
  description = "Application name, used for tagging and resource naming."
  type        = string
}

variable "environment" {
  description = "Deployment environment (e.g. production), used for tagging and resource naming."
  type        = string
}

variable "domain_name" {
  description = "Custom domain for the CloudFront distribution (e.g. pim.uberconcept.com)."
  type        = string
}

variable "certificate_arn" {
  description = "ACM certificate ARN for domain_name. Must be in us-east-1 - a hard CloudFront requirement."
  type        = string
}
