# "Single command" means ready, not just created. Userdata runs asynchronously,
# so without these steps `terraform apply` would finish while the app is still
# installing.

locals {
  instances = {
    frontend = aws_instance.frontend
    backend  = aws_instance.backend
    mysql    = aws_instance.mysql
  }
}

# 1. Per VM: wait until the setup log shows completion, fail if it shows a failure
#    or never reaches the end.
resource "terraform_data" "vm_ready" {
  for_each = local.instances

  triggers_replace = [each.value.id]

  connection {
    type     = "ssh"
    host     = each.value.public_ip
    user     = var.ssh_user
    password = var.ssh_password
    timeout  = "5m"
  }

  # Waits on the setup log itself, not `cloud-init status --wait`: on the
  # course AMI that command can hang forever even after cloud-init is done.
  # Every userdata script ends with "EXPENSE SETUP COMPLETE" or stops at the
  # first "... FAILURE". Checks every 10 s for up to 20 minutes and prints the
  # latest log line every 30 s so the apply shows progress.
  provisioner "remote-exec" {
    inline = [
      "echo 'waiting for setup on ${var.project}-${each.key} (/var/log/expense/setup.log) ...'",
      "LOG=/var/log/expense/setup.log; for i in $(seq 1 120); do if sudo grep -q 'EXPENSE SETUP COMPLETE' $LOG 2>/dev/null; then echo '${var.project}-${each.key}: setup complete'; exit 0; fi; if sudo grep -q ' FAILURE$' $LOG 2>/dev/null; then echo '---- setup.log (last 60 lines) ----'; sudo tail -n 60 $LOG; exit 1; fi; if [ $((i % 3)) -eq 0 ]; then echo \"[$((i * 10))s] $(sudo tail -n 1 $LOG 2>/dev/null | cut -c1-160)\"; fi; sleep 10; done; echo 'setup did not finish within 20 minutes'; sudo tail -n 60 $LOG; exit 1",
    ]
  }
}

# 2. End to end: https://<fqdn>/api/health/ready through DNS, the certificate,
#    the ALB, nginx, the backend and MySQL. Run from the frontend VM rather than
#    with local-exec, so it works the same whether the student runs Terraform on
#    Linux, macOS or Windows. Retries for up to ~5 minutes (DNS propagation and
#    ALB target health lag); the apply FAILS if the app never becomes healthy.
resource "terraform_data" "app_ready" {
  triggers_replace = [
    aws_instance.frontend.id,
    aws_instance.backend.id,
    aws_instance.mysql.id,
    aws_lb_listener.https.id,
    aws_route53_record.app.fqdn,
  ]

  connection {
    type     = "ssh"
    host     = aws_instance.frontend.public_ip
    user     = var.ssh_user
    password = var.ssh_password
    timeout  = "5m"
  }

  provisioner "remote-exec" {
    inline = [
      "for i in $(seq 1 60); do if curl -fsS --max-time 5 https://${local.app_fqdn}/api/health/ready; then echo; echo 'app is ready: https://${local.app_fqdn}'; exit 0; fi; echo \"attempt $i/60: not ready yet\"; sleep 5; done; echo 'app did not become healthy within 5 minutes'; exit 1",
    ]
  }

  depends_on = [
    terraform_data.vm_ready,
    aws_lb_listener.https,
    aws_lb_listener.http,
    aws_lb_target_group_attachment.frontend,
    aws_route53_record.app,
    aws_route53_record.frontend,
    aws_route53_record.backend,
    aws_route53_record.mysql,
  ]
}
