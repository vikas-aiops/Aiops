locals {
  app_fqdn = "${var.app_hostname}.${var.domain_name}"

  # Components reach each other ONLY through these Route53 names, never through
  # IPs baked into userdata (naming-conventions §2.3: <service>.<domain_name>).
  # A replaced VM gets a new private IP; its record is updated in place and the
  # other VMs keep working without being rebuilt.
  tier_hostnames = {
    frontend = "frontend.${var.domain_name}"
    backend  = "backend.${var.domain_name}"
    mysql    = "mysql.${var.domain_name}"
  }

  # Short TTL so a replaced VM is reachable again within about a minute.
  internal_record_ttl = 60

  backend_port = 8080
  mysql_port   = 3306
}
