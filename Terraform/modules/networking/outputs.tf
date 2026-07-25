output "vpc_id" {
  description = "ID of the VPC."
  value       = aws_vpc.main.id
}

output "private_subnet_ids" {
  description = "IDs of the private subnets (one per AZ)."
  value       = aws_subnet.private[*].id
}

output "lambda_security_group_id" {
  description = "Security group ID to attach to the backend Lambda."
  value       = aws_security_group.lambda.id
}
