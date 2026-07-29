module "networking" {
  source = "./modules/networking"

  application = var.application
  environment = var.environment
  vpc_cidr    = var.vpc_cidr
}

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

module "frontend" {
  source = "./modules/frontend"

  application     = var.application
  environment     = var.environment
  domain_name     = var.frontend_domain_name
  certificate_arn = var.frontend_certificate_arn
}

module "api" {
  source = "./modules/api"

  application                    = var.application
  environment                    = var.environment
  private_subnet_ids             = module.networking.private_subnet_ids
  lambda_security_group_id       = module.networking.lambda_security_group_id
  dynamodb_table_arn             = module.data.table_arn
  transaction_dynamodb_table_arn = module.transactions_data.table_arn
  domain_name                    = var.api_domain_name
  certificate_arn                = var.api_certificate_arn
}
