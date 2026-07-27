locals {
  common_tags = {
    application = var.application
    environment = var.environment
  }
}

# The real Api project must be published to ./build before plan/apply can
# read it here (see .github/workflows/terraform.yml's `dotnet publish` step,
# or run it by hand from this directory):
#   dotnet publish ../../../Api -c Release -r linux-x64 --self-contained false -o build
data "archive_file" "api" {
  type        = "zip"
  source_dir  = "${path.module}/build"
  output_path = "${path.module}/build.zip"
}

data "aws_iam_policy_document" "lambda_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda" {
  name               = "${var.application}-${var.environment}-lambda"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json

  tags = local.common_tags
}

# AWS-managed policy: CloudWatch Logs writes + the EC2 ENI permissions a
# VPC-attached Lambda must have to create/manage its network interfaces.
# The ENI permissions are a hard AWS requirement for VPC attachment, not
# optional - see the worklog for why this goes slightly beyond the ticket's
# literal "just logs and DynamoDB" wording.
resource "aws_iam_role_policy_attachment" "lambda_vpc_access" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

data "aws_iam_policy_document" "dynamodb_access" {
  statement {
    sid    = "UserTableAccess"
    effect = "Allow"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
      "dynamodb:DeleteItem",
      "dynamodb:Query",
    ]
    resources = [var.dynamodb_table_arn]
  }
}

resource "aws_iam_role_policy" "dynamodb_access" {
  name   = "${var.application}-${var.environment}-dynamodb-access"
  role   = aws_iam_role.lambda.id
  policy = data.aws_iam_policy_document.dynamodb_access.json
}

resource "aws_lambda_function" "api" {
  function_name = "${var.application}-${var.environment}-api"
  role          = aws_iam_role.lambda.arn
  # Amazon.Lambda.AspNetCoreServer.Hosting's AddAWSLambdaHosting auto-detects
  # the entry point at startup - no Class::Method handler string needed,
  # just the assembly name.
  handler     = "Pim.Api"
  runtime     = "dotnet8"
  timeout     = 30
  memory_size = 128

  filename         = data.archive_file.api.output_path
  source_code_hash = data.archive_file.api.output_base64sha256

  environment {
    variables = {
      ASPNETCORE_ENVIRONMENT = "Production"
    }
  }

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [var.lambda_security_group_id]
  }

  tags = local.common_tags

  # Terraform's own build.zip only creates the function on the very first
  # apply - day-to-day code updates go through .github/workflows/deploy.yml
  # (aws lambda update-function-code) instead, so Terraform shouldn't fight
  # over the deployment package on subsequent applies.
  lifecycle {
    ignore_changes = [filename, source_code_hash]
  }
}

resource "aws_apigatewayv2_api" "api" {
  name          = "${var.application}-${var.environment}-api"
  protocol_type = "HTTP"

  tags = local.common_tags
}

resource "aws_apigatewayv2_integration" "lambda" {
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.api.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "default" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.api.id
  name        = "$default"
  auto_deploy = true

  tags = local.common_tags
}

resource "aws_lambda_permission" "apigw" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
}

resource "aws_apigatewayv2_domain_name" "api" {
  domain_name = var.domain_name

  domain_name_configuration {
    certificate_arn = var.certificate_arn
    endpoint_type   = "REGIONAL"
    security_policy = "TLS_1_2"
  }

  tags = local.common_tags
}

resource "aws_apigatewayv2_api_mapping" "api" {
  api_id      = aws_apigatewayv2_api.api.id
  domain_name = aws_apigatewayv2_domain_name.api.id
  stage       = aws_apigatewayv2_stage.default.id
}
