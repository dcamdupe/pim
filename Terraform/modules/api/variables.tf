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

variable "transaction_dynamodb_table_arn" {
  description = "ARN of the DynamoDB transaction table the Lambda is allowed to access."
  type        = string
}

variable "transaction_descriptions_dynamodb_table_arn" {
  description = "ARN of the DynamoDB unique-descriptions table the Lambda is allowed to access."
  type        = string
}

variable "credit_description_mapping_dynamodb_table_arn" {
  description = "ARN of the DynamoDB credit-description-mapping table the Lambda is allowed to access."
  type        = string
}

variable "domain_name" {
  description = "Custom domain for the API Gateway (e.g. pim-api.uberconcept.com)."
  type        = string
}

variable "certificate_arn" {
  description = "ACM certificate ARN for domain_name. Must be a regional cert in the API's own region - API Gateway v2 custom domains don't support edge-optimized certs."
  type        = string
}
