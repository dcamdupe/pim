variable "application" {
  description = "Application name, used for tagging and resource naming."
  type        = string
}

variable "environment" {
  description = "Deployment environment (e.g. production), used for tagging and resource naming."
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

variable "description_mapping_dynamodb_table_arn" {
  description = "ARN of the DynamoDB description-mapping table the Lambda is allowed to access."
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

variable "cognito_authority" {
  description = "Cognito User Pool issuer URL - passed to the Lambda as CognitoSettings__Authority (see Api/Auth/CognitoSettings.cs)."
  type        = string
}

variable "cognito_app_client_id" {
  description = "Cognito App Client id - passed to the Lambda as CognitoSettings__AppClientId (see Api/Auth/CognitoSettings.cs)."
  type        = string
}
