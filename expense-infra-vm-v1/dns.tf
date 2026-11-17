data "aws_route53_zone" "main" {
  name         = var.domain_name
  private_zone = false
}

# ---- tier records: how the VMs reach each other ------------------------------
# frontend.<domain>, backend.<domain>, mysql.<domain> -> private IPs.
#   frontend nginx -> backend.<domain>:8080
#   backend        -> mysql.<domain>:3306
# They resolve to private addresses, so they only work from inside the VPC.
# These names belong to this stack; allow_overwrite lets a fresh apply take
# them over if an earlier stack's state was lost.
#
# Each record is keyed to its own instance's private IP and nothing else, so
# replacing a VM updates its record in place and leaves the other VMs alone.

# Three separate resources (not one for_each) so each instance can wait for
# exactly its upstream's record without a dependency cycle.

resource "aws_route53_record" "mysql" {
  zone_id         = data.aws_route53_zone.main.zone_id
  name            = local.tier_hostnames.mysql
  type            = "A"
  ttl             = local.internal_record_ttl
  records         = [aws_instance.mysql.private_ip]
  allow_overwrite = true
}

resource "aws_route53_record" "backend" {
  zone_id         = data.aws_route53_zone.main.zone_id
  name            = local.tier_hostnames.backend
  type            = "A"
  ttl             = local.internal_record_ttl
  records         = [aws_instance.backend.private_ip]
  allow_overwrite = true
}

resource "aws_route53_record" "frontend" {
  zone_id         = data.aws_route53_zone.main.zone_id
  name            = local.tier_hostnames.frontend
  type            = "A"
  ttl             = local.internal_record_ttl
  records         = [aws_instance.frontend.private_ip]
  allow_overwrite = true
}

# ---- app record: the public entry point -----------------------------------------

resource "aws_route53_record" "app" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = local.app_fqdn
  type    = "A"

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }

  allow_overwrite = true
}

# ---- ACM certificate, validated through Route53 ------------------------------

resource "aws_acm_certificate" "app" {
  domain_name       = local.app_fqdn
  validation_method = "DNS"
  tags              = { Name = "${var.project}-cert", Tier = "edge" }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.app.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      type   = dvo.resource_record_type
      record = dvo.resource_record_value
    }
  }

  zone_id         = data.aws_route53_zone.main.zone_id
  name            = each.value.name
  type            = each.value.type
  ttl             = 60
  records         = [each.value.record]
  allow_overwrite = true
}

resource "aws_acm_certificate_validation" "app" {
  certificate_arn         = aws_acm_certificate.app.arn
  validation_record_fqdns = [for r in aws_route53_record.cert_validation : r.fqdn]
}
