output "bucket_name" {
  description = "Name of the S3 bucket the built FrontEnd assets should be uploaded to."
  value       = aws_s3_bucket.frontend.id
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID, e.g. for cache invalidation after a deploy."
  value       = aws_cloudfront_distribution.frontend.id
}

output "cloudfront_domain_name" {
  description = "Public domain name of the CloudFront distribution."
  value       = aws_cloudfront_distribution.frontend.domain_name
}
