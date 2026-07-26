# Only the key attribute needs to be declared for DynamoDB - the "data"
# attribute (arbitrary JSON) is schemaless and written directly by the
# application without any Terraform-side declaration.
#
# Table name is just the entity name (var.table_name, e.g. "User") - no
# application/environment prefix. DynamoDbRepository<T> on the Api side
# derives the same name from typeof(T).Name. Each environment is its own
# separate AWS account (see Terraform/README.md), so table names only need
# to be unique per account+region - there's nothing else in the account for
# them to collide with.
resource "aws_dynamodb_table" "table" {
  name         = var.table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  tags = {
    application = var.application
    environment = var.environment
  }
}
