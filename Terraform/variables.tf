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
