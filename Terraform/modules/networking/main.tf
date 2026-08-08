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

# One public subnet for the downloader module's scheduled Fargate task - unlike the Lambda, that
# task has to reach the real internet (the bank's own site), not just AWS service endpoints, so a
# private subnet + gateway endpoints can't work for it. A single subnet (not one per AZ, unlike
# private above) is enough for a single once-daily batch task with no availability requirement.
# High cidrsubnet index (200) keeps it well clear of aws_subnet.private's low indices regardless
# of az_count.
resource "aws_subnet" "public" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, 200)
  availability_zone = local.azs[0]

  tags = merge(local.common_tags, { Name = "${var.application}-${var.environment}-public" })
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = merge(local.common_tags, { Name = "${var.application}-${var.environment}" })
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = merge(local.common_tags, { Name = "${var.application}-${var.environment}-public" })
}

resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

# No NAT Gateway / Internet Gateway: the Lambda in these subnets only needs
# DynamoDB, reached via the gateway endpoint below, so there's no need for
# general internet egress. CloudWatch Logs delivery for the function doesn't
# go through the function's VPC ENI at all - it's handled by the Lambda
# service's own internal infrastructure - so no endpoint is needed for that.
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

# The DynamoDB gateway endpoint has no ENI in the subnet - traffic to it is
# addressed to DynamoDB's real AWS IP range (routed via the endpoint's prefix
# list), not var.vpc_cidr. NACLs evaluate against that real destination, so
# without these rules the traffic falls through to the implicit deny even
# though the security group and route table are both correctly configured.
# aws_ip_ranges looks the current ranges up live per aws_region.current, so
# nothing here is hardcoded to a specific region.
data "aws_ip_ranges" "dynamodb" {
  regions  = [data.aws_region.current.region]
  services = ["dynamodb"]
}

resource "aws_network_acl_rule" "private_outbound_dynamodb" {
  for_each = { for idx, cidr in data.aws_ip_ranges.dynamodb.cidr_blocks : idx => cidr }

  network_acl_id = aws_network_acl.private.id
  rule_number    = 110 + each.key
  egress         = true
  protocol       = "tcp"
  rule_action    = "allow"
  cidr_block     = each.value
  from_port      = 443
  to_port        = 443
}

resource "aws_network_acl_rule" "private_inbound_dynamodb" {
  for_each = { for idx, cidr in data.aws_ip_ranges.dynamodb.cidr_blocks : idx => cidr }

  network_acl_id = aws_network_acl.private.id
  rule_number    = 210 + each.key
  egress         = false
  protocol       = "tcp"
  rule_action    = "allow"
  cidr_block     = each.value
  from_port      = 1024
  to_port        = 65535
}

resource "aws_security_group" "lambda" {
  name        = "${var.application}-${var.environment}-lambda"
  description = "Security group for the API Lambda"
  vpc_id      = aws_vpc.main.id

  # AWS auto-creates an "allow all outbound" rule for every new security
  # group. Declaring the egress rule inline (rather than as a separate
  # aws_vpc_security_group_egress_rule resource) both strips that default and
  # avoids a provider conflict: an inline egress block - even an empty one -
  # makes this resource authoritative over the SG's egress rules, so on every
  # apply it silently revokes any rule managed by a separate resource,
  # forcing that resource to be recreated on the next plan.
  egress {
    description     = "HTTPS to the DynamoDB gateway endpoint"
    protocol        = "tcp"
    from_port       = 443
    to_port         = 443
    prefix_list_ids = [aws_vpc_endpoint.dynamodb.prefix_list_id]
  }

  tags = merge(local.common_tags, { Name = "${var.application}-${var.environment}-lambda" })
}

resource "aws_vpc_endpoint" "dynamodb" {
  vpc_id            = aws_vpc.main.id
  service_name      = "com.amazonaws.${data.aws_region.current.region}.dynamodb"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = [aws_route_table.private.id]

  tags = merge(local.common_tags, { Name = "${var.application}-${var.environment}-dynamodb" })
}

data "aws_region" "current" {}
