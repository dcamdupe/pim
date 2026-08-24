locals {
  common_tags = {
    application = var.application
    environment = var.environment
  }
}

data "aws_region" "current" {}

data "aws_iam_policy_document" "pre_signup_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "pre_signup" {
  name               = "${var.application}-${var.environment}-cognito-pre-signup"
  assume_role_policy = data.aws_iam_policy_document.pre_signup_assume_role.json

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "pre_signup_logs" {
  role       = aws_iam_role.pre_signup.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Declared explicitly so it has our standard 6-month retention instead of AWS's default
# "never expire" - same reasoning as the api module's log group.
resource "aws_cloudwatch_log_group" "pre_signup" {
  name              = "/aws/lambda/${var.application}-${var.environment}-cognito-pre-signup"
  retention_in_days = 180

  tags = local.common_tags
}

resource "aws_lambda_function" "pre_signup" {
  function_name = "${var.application}-${var.environment}-cognito-pre-signup"
  role          = aws_iam_role.pre_signup.arn
  handler       = "pre_signup.handler"
  runtime       = "nodejs20.x"
  timeout       = 5
  memory_size   = 128

  # Committed zip, not archive_file - that only builds the zip at plan time, which apply (a
  # separate job/runner) never sees. To edit: unzip, edit pre_signup.js, then
  # zip -j -X pre_signup.zip pre_signup.js
  filename         = "${path.module}/pre_signup.zip"
  source_code_hash = filebase64sha256("${path.module}/pre_signup.zip")

  environment {
    variables = {
      ALLOWED_EMAILS = join(",", var.allowed_emails)
    }
  }

  tags = local.common_tags

  depends_on = [aws_cloudwatch_log_group.pre_signup]
}

resource "aws_lambda_permission" "cognito_invoke_pre_signup" {
  statement_id  = "AllowCognitoInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.pre_signup.function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.this.arn
}

resource "aws_cognito_user_pool" "this" {
  name = "${var.application}-${var.environment}"

  # Federated (Google) sign-in only - no native username/password pool, so this only affects the
  # attribute Cognito records on the auto-provisioned user record, not any sign-in method.
  auto_verified_attributes = ["email"]

  lambda_config {
    pre_sign_up = aws_lambda_function.pre_signup.arn
  }

  tags = local.common_tags
}

resource "aws_cognito_user_pool_domain" "this" {
  domain       = var.domain_prefix
  user_pool_id = aws_cognito_user_pool.this.id
}

# The Google OAuth client id/secret are deliberately not Terraform variables sourced from a
# committed tfvars file - created manually in Google Cloud Console and supplied via
# TF_VAR_google_client_id / TF_VAR_google_client_secret at apply time, same pattern as the
# OIDC IAM role being kept out of Terraform state entirely. See docs/worklogs for the
# Google Cloud Console setup steps.
resource "aws_cognito_identity_provider" "google" {
  user_pool_id  = aws_cognito_user_pool.this.id
  provider_name = "Google"
  provider_type = "Google"

  provider_details = {
    client_id        = var.google_client_id
    client_secret    = var.google_client_secret
    authorize_scopes = "openid email profile"
  }

  attribute_mapping = {
    email    = "email"
    username = "sub"
  }
}

resource "aws_cognito_user_pool_client" "this" {
  name         = "${var.application}-${var.environment}-client"
  user_pool_id = aws_cognito_user_pool.this.id

  # Public SPA client using PKCE (authorization-code flow, no client secret) - the FrontEnd is a
  # static site with no server to keep a secret confidential.
  generate_secret = false

  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["openid", "email", "profile"]
  supported_identity_providers         = ["Google"]

  # pim://auth/callback is the iOS app's redirect_uri (see iosApp/iosApp/Config/AuthConfig.swift) -
  # ASWebAuthenticationSession catches it via the CFBundleURLTypes scheme registered in its Info.plist.
  callback_urls = ["https://${var.frontend_domain_name}/auth/callback", "pim://auth/callback"]
  logout_urls   = ["https://${var.frontend_domain_name}/login", "pim://auth/callback"]

  prevent_user_existence_errors = "ENABLED"

  depends_on = [aws_cognito_identity_provider.google]
}
