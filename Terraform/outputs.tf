output "frontend_cloudfront_domain_name" {
  description = "Public domain name of the CloudFront distribution serving the FrontEnd."
  value       = module.frontend.cloudfront_domain_name
}

output "backend_api_endpoint" {
  description = "Invoke URL of the backend HTTP API Gateway."
  value       = module.backend.api_endpoint
}

output "dynamodb_table_name" {
  description = "Name of the DynamoDB users table."
  value       = module.data.table_name
}
