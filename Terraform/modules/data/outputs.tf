output "table_name" {
  description = "Name of the DynamoDB users table."
  value       = aws_dynamodb_table.users.name
}

output "table_arn" {
  description = "ARN of the DynamoDB users table."
  value       = aws_dynamodb_table.users.arn
}
