output "frontend_cloudfront_domain_name" {
  description = "Public domain name of the CloudFront distribution serving the FrontEnd."
  value       = module.frontend.cloudfront_domain_name
}

output "api_endpoint" {
  description = "Invoke URL of the HTTP API Gateway."
  value       = module.api.api_endpoint
}

output "dynamodb_table_name" {
  description = "Name of the DynamoDB users table."
  value       = module.data.table_name
}

output "frontend_bucket_name" {
  description = "Name of the S3 bucket the built FrontEnd assets are uploaded to. Copy into the deploy workflow's FRONTEND_BUCKET_NAME repo variable."
  value       = module.frontend.bucket_name
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID, used to invalidate the cache after a deploy. Copy into the deploy workflow's CLOUDFRONT_DISTRIBUTION_ID repo variable."
  value       = module.frontend.cloudfront_distribution_id
}

output "api_lambda_function_name" {
  description = "Name of the API Lambda function. Copy into the deploy workflow's API_LAMBDA_FUNCTION_NAME repo variable."
  value       = module.api.lambda_function_name
}

output "api_custom_domain_target" {
  description = "Target domain name for the API's custom domain - point api_domain_name's DNS record (CNAME/ALIAS) at this."
  value       = module.api.custom_domain_target
}

output "cognito_hosted_ui_domain" {
  description = "Cognito Hosted UI domain. Copy into the FrontEnd's VITE_COGNITO_DOMAIN build-time env var."
  value       = module.cognito.hosted_ui_domain
}

output "cognito_app_client_id" {
  description = "Cognito App Client id. Copy into the FrontEnd's VITE_COGNITO_CLIENT_ID build-time env var."
  value       = module.cognito.app_client_id
}
