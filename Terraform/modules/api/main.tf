locals {
  common_tags = {
    application = var.application
    environment = var.environment
  }
}

# The stub handler must be published before this module can plan/apply:
#   dotnet publish -c Release -r linux-x64 --self-contained false -o publish
# (run from modules/api/lambda-stub/). This will be replaced by the real
# Api-based handler in a future ticket.
data "archive_file" "lambda" {
  type        = "zip"
  source_dir  = "${path.module}/lambda-stub/publish"
  output_path = "${path.module}/lambda-stub/lambda.zip"
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
  handler       = "Pim.Api.LambdaStub::Pim.Api.LambdaStub.Function::Handler"
  runtime       = "dotnet8"
  timeout       = 30
  memory_size   = 128

  filename         = data.archive_file.lambda.output_path
  source_code_hash = data.archive_file.lambda.output_base64sha256

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [var.lambda_security_group_id]
  }

  tags = local.common_tags

  # Once the real Api-based handler is deployed by CI/CD, Terraform should
  # stop fighting over the deployment package/handler.
  lifecycle {
    ignore_changes = [filename, source_code_hash, handler]
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
