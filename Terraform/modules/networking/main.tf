data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  common_tags = {
    application = var.application
    environment = var.environment
  }
  azs = slice(data.aws_availability_zones.available.names, 0, var.az_count)
}

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = merge(local.common_tags, { Name = "${var.application}-${var.environment}" })
}

resource "aws_subnet" "private" {
  count = var.az_count

  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index)
  availability_zone = local.azs[count.index]

  tags = merge(local.common_tags, {
    Name = "${var.application}-${var.environment}-private-${local.azs[count.index]}"
  })
}

# No NAT Gateway / Internet Gateway: the Lambda in these subnets only needs
# DynamoDB + CloudWatch Logs, both reached via VPC endpoints below, so there's
# no need for general internet egress.
resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id

  tags = merge(local.common_tags, { Name = "${var.application}-${var.environment}-private" })
}

resource "aws_route_table_association" "private" {
  count = var.az_count

  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}

resource "aws_network_acl" "private" {
  vpc_id     = aws_vpc.main.id
  subnet_ids = aws_subnet.private[*].id

  tags = merge(local.common_tags, { Name = "${var.application}-${var.environment}-private" })
}

# Only intra-VPC traffic is allowed; everything else falls through to the
# implicit deny, since nothing in these subnets needs to reach the internet.
resource "aws_network_acl_rule" "private_inbound_vpc" {
  network_acl_id = aws_network_acl.private.id
  rule_number    = 100
  egress         = false
  protocol       = "-1"
  rule_action    = "allow"
  cidr_block     = var.vpc_cidr
  from_port      = 0
  to_port        = 0
}

resource "aws_network_acl_rule" "private_outbound_vpc" {
  network_acl_id = aws_network_acl.private.id
  rule_number    = 100
  egress         = true
  protocol       = "-1"
  rule_action    = "allow"
  cidr_block     = var.vpc_cidr
  from_port      = 0
  to_port        = 0
}

resource "aws_security_group" "lambda" {
  name        = "${var.application}-${var.environment}-lambda"
  description = "Security group for the backend Lambda"
  vpc_id      = aws_vpc.main.id

  tags = merge(local.common_tags, { Name = "${var.application}-${var.environment}-lambda" })
}

resource "aws_security_group" "vpc_endpoints" {
  name        = "${var.application}-${var.environment}-vpc-endpoints"
  description = "Security group for interface VPC endpoints"
  vpc_id      = aws_vpc.main.id

  tags = merge(local.common_tags, { Name = "${var.application}-${var.environment}-vpc-endpoints" })
}

resource "aws_vpc_security_group_egress_rule" "lambda_to_dynamodb_endpoint" {
  security_group_id = aws_security_group.lambda.id
  description       = "HTTPS to the DynamoDB gateway endpoint"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
  prefix_list_id    = aws_vpc_endpoint.dynamodb.prefix_list_id
}

resource "aws_vpc_security_group_egress_rule" "lambda_to_logs_endpoint" {
  security_group_id            = aws_security_group.lambda.id
  description                  = "HTTPS to the CloudWatch Logs interface endpoint"
  ip_protocol                  = "tcp"
  from_port                    = 443
  to_port                      = 443
  referenced_security_group_id = aws_security_group.vpc_endpoints.id
}

resource "aws_vpc_security_group_ingress_rule" "vpc_endpoints_from_lambda" {
  security_group_id            = aws_security_group.vpc_endpoints.id
  description                  = "HTTPS from the Lambda"
  ip_protocol                  = "tcp"
  from_port                    = 443
  to_port                      = 443
  referenced_security_group_id = aws_security_group.lambda.id
}

resource "aws_vpc_endpoint" "dynamodb" {
  vpc_id            = aws_vpc.main.id
  service_name      = "com.amazonaws.${data.aws_region.current.name}.dynamodb"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = [aws_route_table.private.id]

  tags = merge(local.common_tags, { Name = "${var.application}-${var.environment}-dynamodb" })
}

resource "aws_vpc_endpoint" "logs" {
  vpc_id              = aws_vpc.main.id
  service_name        = "com.amazonaws.${data.aws_region.current.name}.logs"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private[*].id
  security_group_ids  = [aws_security_group.vpc_endpoints.id]
  private_dns_enabled = true

  tags = merge(local.common_tags, { Name = "${var.application}-${var.environment}-logs" })
}

data "aws_region" "current" {}
