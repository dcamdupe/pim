variable "aws_region" {
  description = "AWS region for the Terraform state backend resources."
  type        = string
  default     = "ap-southeast-2"
}

variable "application" {
  description = "Application name, used for tagging and resource naming."
  type        = string
  default     = "pim"
}
