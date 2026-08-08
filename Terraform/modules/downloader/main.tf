locals {
  common_tags = {
    application = var.application
    environment = var.environment
  }
  name = "${var.application}-${var.environment}-downloader"
}

# --- ECR ------------------------------------------------------------------

resource "aws_ecr_repository" "this" {
  name                 = local.name
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = local.common_tags
}

# Keeps only the ecr_image_retention_count most-recently-pushed images - older ones expire
# automatically so this doesn't accumulate unbounded storage cost over a daily-pushed image.
resource "aws_ecr_lifecycle_policy" "this" {
  repository = aws_ecr_repository.this.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep only the ${var.ecr_image_retention_count} most recent images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = var.ecr_image_retention_count
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

# --- Logs -------------------------------------------------------------------

resource "aws_cloudwatch_log_group" "this" {
  name              = "/ecs/${local.name}"
  retention_in_days = var.log_retention_days

  tags = local.common_tags
}

# --- IAM: task execution role (pull the image, write logs) ------------------

data "aws_iam_policy_document" "ecs_tasks_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "execution" {
  name               = "${local.name}-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume_role.json

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "execution" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# --- IAM: task role (what the running container/app code itself assumes) ----

data "aws_secretsmanager_secret" "pim_data" {
  name = var.pim_data_secret_name
}

resource "aws_iam_role" "task" {
  name               = "${local.name}-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume_role.json

  tags = local.common_tags
}

data "aws_iam_policy_document" "pim_data_secret_access" {
  statement {
    sid       = "ReadPimDataSecret"
    effect    = "Allow"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [data.aws_secretsmanager_secret.pim_data.arn]
  }
}

resource "aws_iam_role_policy" "pim_data_secret_access" {
  name   = "${local.name}-pim-data-secret-access"
  role   = aws_iam_role.task.id
  policy = data.aws_iam_policy_document.pim_data_secret_access.json
}

# --- Networking ---------------------------------------------------------------

# Egress-only: this task calls out to the bank's site and the PIM Api, but never listens for
# inbound traffic, so there's nothing to allow in.
resource "aws_security_group" "task" {
  name        = "${local.name}-task"
  description = "Security group for the downloader Fargate task"
  vpc_id      = var.vpc_id

  egress {
    description = "HTTPS outbound"
    protocol    = "tcp"
    from_port   = 443
    to_port     = 443
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "HTTP outbound"
    protocol    = "tcp"
    from_port   = 80
    to_port     = 80
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, { Name = "${local.name}-task" })
}

# --- ECS: cluster + task definition ------------------------------------------

resource "aws_ecs_cluster" "this" {
  name = local.name

  tags = local.common_tags
}

# image is the ":latest" tag rather than a pinned digest - .github/workflows pushes a new
# ":latest" and registers a fresh task definition revision on every deploy (see
# Terraform/README.md), so this initial apply's image just needs to exist, not be current.
resource "aws_ecs_task_definition" "this" {
  family                   = local.name
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.task_cpu
  memory                   = var.task_memory
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  container_definitions = jsonencode([
    {
      name      = "downloader"
      image     = "${aws_ecr_repository.this.repository_url}:latest"
      essential = true
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.this.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "downloader"
        }
      }
    }
  ])

  tags = local.common_tags

  # A new image is pushed and a new revision registered by
  # .github/workflows/downloader-deploy.yml on every deploy - Terraform shouldn't fight over
  # container_definitions on subsequent applies, same convention as the API Lambda's deployment
  # package (see modules/api/main.tf).
  lifecycle {
    ignore_changes = [container_definitions]
  }
}

# --- EventBridge Scheduler: daily trigger ------------------------------------

data "aws_iam_policy_document" "scheduler_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["scheduler.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "scheduler" {
  name               = "${local.name}-scheduler"
  assume_role_policy = data.aws_iam_policy_document.scheduler_assume_role.json

  tags = local.common_tags
}

data "aws_iam_policy_document" "scheduler_run_task" {
  statement {
    sid       = "RunTask"
    effect    = "Allow"
    actions   = ["ecs:RunTask"]
    resources = [aws_ecs_task_definition.this.arn]
  }

  # RunTask needs to pass both roles through to the task it starts.
  statement {
    sid       = "PassTaskRoles"
    effect    = "Allow"
    actions   = ["iam:PassRole"]
    resources = [aws_iam_role.execution.arn, aws_iam_role.task.arn]
  }
}

resource "aws_iam_role_policy" "scheduler_run_task" {
  name   = "${local.name}-scheduler-run-task"
  role   = aws_iam_role.scheduler.id
  policy = data.aws_iam_policy_document.scheduler_run_task.json
}

# EventBridge Scheduler (not a plain aws_cloudwatch_event_rule) specifically because it supports
# schedule_expression_timezone - a plain rule's cron is UTC-only, which would need the expression
# hand-adjusted twice a year across Sydney's AEST/AEDT DST transition.
resource "aws_scheduler_schedule" "daily" {
  name = "${local.name}-daily"

  flexible_time_window {
    mode = "OFF"
  }

  schedule_expression          = var.schedule_expression
  schedule_expression_timezone = var.schedule_timezone

  target {
    arn      = aws_ecs_cluster.this.arn
    role_arn = aws_iam_role.scheduler.arn

    ecs_parameters {
      # Family name, not a pinned revision - ECS's RunTask resolves a bare family to its latest
      # ACTIVE revision, so a new image pushed via the deploy workflow takes effect on the very
      # next scheduled run without needing to touch this schedule.
      task_definition_arn = aws_ecs_task_definition.this.family
      launch_type         = "FARGATE"

      network_configuration {
        subnets          = [var.public_subnet_id]
        security_groups  = [aws_security_group.task.id]
        assign_public_ip = true
      }
    }

    retry_policy {
      maximum_retry_attempts = 0
    }
  }
}
