# Course AMI: RHEL 9 DevOps practice image (SSH user ec2-user).
data "aws_ami" "joindevops" {
  most_recent = true
  owners      = ["973714476881"]

  filter {
    name   = "name"
    values = ["Redhat-9-DevOps-Practice"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# No EC2 key pair: the course AMI logs in with a username and password
# (ssh_user / ssh_password in variables.tf).

# ---- secrets (never variables with defaults) ---------------------------------
# Alphanumeric only, so they are safe in shell, SQL, systemd and env files.

resource "random_password" "mysql_root" {
  length  = 24
  special = false
}

resource "random_password" "db_app" {
  length  = 24
  special = false
}

resource "random_password" "jwt_secret" {
  length  = 48
  special = false
}

# ---- instances -----------------------------------------------------------------
# Userdata never contains another VM's IP: each VM reaches its upstream through
# the upstream's Route53 record (dns.tf). Each instance waits for its upstream's
# record to EXIST before booting (depends_on), so the first lookup never hits a
# missing name: resolvers cache "no such name" for up to 15 minutes. depends_on
# only orders creation; it never forces a replacement.

resource "aws_instance" "mysql" {
  ami                         = data.aws_ami.joindevops.id
  instance_type               = var.mysql_instance_type
  subnet_id                   = aws_subnet.public["a"].id
  vpc_security_group_ids      = [aws_security_group.mysql.id]
  user_data_replace_on_change = true

  user_data = templatefile("${path.module}/templates/mysql.sh.tftpl", {
    hostname            = "${var.project}-mysql"
    mysql_root_password = random_password.mysql_root.result
    db_name             = var.db_name
    db_user             = var.db_user
    db_password         = random_password.db_app.result
    repo_url            = var.mysql_repo_url
    repo_ref            = var.mysql_repo_ref
  })

  root_block_device {
    volume_type = "gp3"
    volume_size = 20
  }

  tags        = { Name = "${var.project}-mysql", Tier = "mysql" }
  volume_tags = { Name = "${var.project}-mysql", Tier = "mysql", Project = var.project, Environment = "lab", ManagedBy = "terraform" }
}

resource "aws_instance" "backend" {
  ami                         = data.aws_ami.joindevops.id
  instance_type               = var.backend_instance_type
  subnet_id                   = aws_subnet.public["b"].id
  vpc_security_group_ids      = [aws_security_group.backend.id]
  user_data_replace_on_change = true

  user_data = templatefile("${path.module}/templates/backend.sh.tftpl", {
    hostname     = "${var.project}-backend"
    node_version = var.node_version
    repo_url     = var.backend_repo_url
    repo_ref     = var.backend_repo_ref
    port         = local.backend_port
    db_host      = local.tier_hostnames.mysql
    db_port      = local.mysql_port
    db_name      = var.db_name
    db_user      = var.db_user
    db_password  = random_password.db_app.result
    jwt_secret   = random_password.jwt_secret.result
    extra_env    = var.backend_extra_env
  })

  root_block_device {
    volume_type = "gp3"
    volume_size = 20
  }

  tags        = { Name = "${var.project}-backend", Tier = "backend" }
  volume_tags = { Name = "${var.project}-backend", Tier = "backend", Project = var.project, Environment = "lab", ManagedBy = "terraform" }

  depends_on = [aws_route53_record.mysql]
}

resource "aws_instance" "frontend" {
  ami                         = data.aws_ami.joindevops.id
  instance_type               = var.frontend_instance_type
  subnet_id                   = aws_subnet.public["a"].id
  vpc_security_group_ids      = [aws_security_group.frontend.id]
  user_data_replace_on_change = true

  user_data = templatefile("${path.module}/templates/frontend.sh.tftpl", {
    hostname     = "${var.project}-frontend"
    node_version = var.node_version
    repo_url     = var.frontend_repo_url
    repo_ref     = var.frontend_repo_ref
    backend_host = local.tier_hostnames.backend
    backend_port = local.backend_port
  })

  root_block_device {
    volume_type = "gp3"
    volume_size = 20
  }

  tags        = { Name = "${var.project}-frontend", Tier = "frontend" }
  volume_tags = { Name = "${var.project}-frontend", Tier = "frontend", Project = var.project, Environment = "lab", ManagedBy = "terraform" }

  depends_on = [aws_route53_record.backend]
}
