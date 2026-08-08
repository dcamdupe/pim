variable "application" {
  description = "Application name, used for tagging and resource naming."
  type        = string
}

variable "environment" {
  description = "Deployment environment (e.g. production), used for tagging and resource naming."
  type        = string
}

variable "aws_region" {
  description = "AWS region the schedule's cron target runs in - needed for the ECS RunTask target ARNs."
  type        = string
}

variable "vpc_id" {
  description = "VPC ID the Fargate task's security group belongs to."
  type        = string
}

variable "public_subnet_id" {
  description = "Public subnet ID to run the Fargate task in - it needs real internet egress to reach the bank's site, not just AWS service endpoints."
  type        = string
}

variable "pim_data_secret_name" {
  description = "Name of the existing Secrets Manager secret (JSON: WestpacCustomerId/WestpacPassword/WestpacAccount/BaseUrl/PimLogin/PimPassword/PimAccount) the task role is granted read access to. Created by hand, same as the ACM certs (see Terraform/README.md) - not Terraform-provisioned, since its value is real bank/login credentials that shouldn't pass through tfstate."
  type        = string
  default     = "pim_data"
}

variable "schedule_expression" {
  description = "EventBridge Scheduler cron expression, evaluated in schedule_timezone."
  type        = string
  default     = "cron(0 23 * * ? *)"
}

variable "schedule_timezone" {
  description = "IANA timezone the schedule_expression is evaluated in - EventBridge Scheduler (unlike a plain EventBridge rule) handles DST transitions natively, so this doesn't need manual UTC-offset adjustment twice a year."
  type        = string
  default     = "Australia/Sydney"
}

variable "task_cpu" {
  description = "Fargate task vCPU units (1024 = 1 vCPU). Headless Chromium needs a reasonable amount of memory/CPU to run reliably."
  type        = string
  default     = "1024"
}

variable "task_memory" {
  description = "Fargate task memory in MB. Must be a valid pairing for task_cpu - see https://docs.aws.amazon.com/AmazonECS/latest/developerguide/fargate-task-defs.html"
  type        = string
  default     = "2048"
}

variable "log_retention_days" {
  description = "CloudWatch Logs retention for the task's log group."
  type        = number
  default     = 30
}

variable "ecr_image_retention_count" {
  description = "Number of most-recent images to retain in ECR before older ones expire."
  type        = number
  default     = 5
}
