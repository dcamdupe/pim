module "data" {
  source = "./modules/data"

  application = var.application
  environment = var.environment
  table_name  = "User"
}

module "transactions_data" {
  source = "./modules/data"

  application = var.application
  environment = var.environment
  table_name  = "TransactionMonth"
}

module "transaction_descriptions_data" {
  source = "./modules/data"

  application = var.application
  environment = var.environment
  table_name  = "TransactionDescriptions"
}

module "description_mapping_data" {
  source = "./modules/data"

  application = var.application
  environment = var.environment
  table_name  = "DescriptionMapping"
}

module "frontend" {
  source = "./modules/frontend"

  application     = var.application
  environment     = var.environment
  domain_name     = var.frontend_domain_name
  certificate_arn = var.frontend_certificate_arn
}

module "cognito" {
  source = "./modules/cognito"

  application          = var.application
  environment          = var.environment
  frontend_domain_name = var.frontend_domain_name
  domain_prefix        = var.cognito_domain_prefix
  allowed_emails       = var.cognito_allowed_emails
  google_client_id     = var.google_client_id
  google_client_secret = var.google_client_secret
}

module "api" {
  source = "./modules/api"

  application                                 = var.application
  environment                                 = var.environment
  dynamodb_table_arn                          = module.data.table_arn
  transaction_dynamodb_table_arn              = module.transactions_data.table_arn
  transaction_descriptions_dynamodb_table_arn = module.transaction_descriptions_data.table_arn
  description_mapping_dynamodb_table_arn      = module.description_mapping_data.table_arn
  domain_name                                 = var.api_domain_name
  certificate_arn                             = var.api_certificate_arn
  cognito_authority                           = module.cognito.authority
  cognito_app_client_id                       = module.cognito.app_client_id
}
