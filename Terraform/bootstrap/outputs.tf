output "state_bucket_name" {
  description = "Name of the S3 bucket holding Terraform remote state. Reference this in each environment's backend.tf."
  value       = aws_s3_bucket.terraform_state.id
}

output "lock_table_name" {
  description = "Name of the DynamoDB table used for Terraform state locking. Reference this in each environment's backend.tf."
  value       = aws_dynamodb_table.terraform_lock.name
}
