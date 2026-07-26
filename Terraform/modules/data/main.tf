# Only the key attribute needs to be declared for DynamoDB - the "data"
# attribute (arbitrary JSON) is schemaless and written directly by the
# application without any Terraform-side declaration.
resource "aws_dynamodb_table" "users" {
  name         = "${var.application}-${var.environment}-users"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "userId"

  attribute {
    name = "userId"
    type = "S"
  }

  tags = {
    application = var.application
    environment = var.environment
  }
}
