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

output "downloader_ecr_repository_url" {
  description = "ECR repository URL for the downloader image. Copy into the downloader deploy workflow's DOWNLOADER_ECR_REPOSITORY_URL repo variable."
  value       = module.downloader.ecr_repository_url
}

output "downloader_ecs_cluster_name" {
  description = "Name of the ECS cluster the scheduled downloader task runs in. Copy into the downloader deploy workflow's DOWNLOADER_ECS_CLUSTER repo variable."
  value       = module.downloader.ecs_cluster_name
}

output "downloader_ecs_task_definition_family" {
  description = "Task definition family the downloader deploy workflow registers new revisions under. Copy into the downloader deploy workflow's DOWNLOADER_TASK_FAMILY repo variable."
  value       = module.downloader.ecs_task_definition_family
}
