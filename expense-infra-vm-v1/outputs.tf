output "app_url" {
  description = "The app, over HTTPS."
  value       = "https://${local.app_fqdn}"
}

output "ssh_commands" {
  description = "SSH into each VM (password: the ssh_password variable, DevOps321 by default)."
  value = {
    for tier, inst in local.instances :
    tier => "ssh ${var.ssh_user}@${inst.public_ip}"
  }
}

output "tier_hostnames" {
  description = "Route53 names the VMs use to reach each other (resolve to private IPs, inside the VPC only)."
  value       = local.tier_hostnames
}

output "private_ips" {
  description = "Private IP per tier (Session 1: these, or the tier_hostnames, go into prometheus.yml)."
  value       = { for tier, inst in local.instances : tier => inst.private_ip }
}

output "db_password" {
  description = "MySQL application user password."
  value       = random_password.db_app.result
  sensitive   = true
}

output "mysql_root_password" {
  description = "MySQL root password (root@localhost on the mysql VM)."
  value       = random_password.mysql_root.result
  sensitive   = true
}

output "jwt_secret" {
  description = "Backend JWT signing secret."
  value       = random_password.jwt_secret.result
  sensitive   = true
}
