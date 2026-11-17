data "aws_availability_zones" "available" {
  state = "available"
}

resource "aws_vpc" "main" {
  cidr_block = "10.0.0.0/16"

  # Required for the VPC resolver, which the VMs use to resolve the tier records.
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = { Name = "${var.project}-vpc", Tier = "network" }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "${var.project}-igw", Tier = "network" }
}

# Two public subnets in two AZs (the ALB needs two). No NAT gateway (cost):
# instances get public IPs for SSH and package installs.
resource "aws_subnet" "public" {
  for_each = {
    a = { cidr = "10.0.1.0/24", az = data.aws_availability_zones.available.names[0] }
    b = { cidr = "10.0.2.0/24", az = data.aws_availability_zones.available.names[1] }
  }

  vpc_id                  = aws_vpc.main.id
  cidr_block              = each.value.cidr
  availability_zone       = each.value.az
  map_public_ip_on_launch = true

  tags = { Name = "${var.project}-public-${each.key}", Tier = "network" }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = { Name = "${var.project}-public-rt", Tier = "network" }
}

resource "aws_route_table_association" "public" {
  for_each       = aws_subnet.public
  subnet_id      = each.value.id
  route_table_id = aws_route_table.public.id
}
