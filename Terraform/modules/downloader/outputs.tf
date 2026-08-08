output "ecr_repository_url" {
  description = "ECR repository URL to push the downloader image to. Copy into the deploy workflow's DOWNLOADER_ECR_REPOSITORY_URL repo variable."
  value       = aws_ecr_repository.this.repository_url
}

output "ecs_cluster_name" {
  description = "Name of the ECS cluster the scheduled task runs in. Copy into the deploy workflow's DOWNLOADER_ECS_CLUSTER repo variable."
  value       = aws_ecs_cluster.this.name
}

output "ecs_task_definition_family" {
  description = "Task definition family - the deploy workflow registers new revisions under this same family."
  value       = aws_ecs_task_definition.this.family
}

output "log_group_name" {
  description = "CloudWatch Logs group the task's output goes to."
  value       = aws_cloudwatch_log_group.this.name
}
