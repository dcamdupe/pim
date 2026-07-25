variable "application" {
  description = "Application name, used for tagging and resource naming."
  type        = string
}

variable "environment" {
  description = "Deployment environment (e.g. production), used for tagging and resource naming."
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs to attach the Lambda to."
  type        = list(string)
}

variable "lambda_security_group_id" {
  description = "Security group ID to attach to the Lambda."
  type        = string
}

variable "dynamodb_table_arn" {
  description = "ARN of the DynamoDB user table the Lambda is allowed to access."
  type        = string
}
