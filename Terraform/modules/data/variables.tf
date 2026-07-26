variable "application" {
  description = "Application name, used for tagging and resource naming."
  type        = string
}

variable "environment" {
  description = "Deployment environment (e.g. production), used for tagging and resource naming."
  type        = string
}

variable "table_name" {
  description = "DynamoDB table name - matches the C# entity's type name (e.g. \"User\"), no application/environment prefix (each environment is its own AWS account)."
  type        = string
}
