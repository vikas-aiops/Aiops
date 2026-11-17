# expense-infra-vm-v1

One `terraform apply` brings up the 3-tier Expense app on EC2, reachable over
HTTPS at `https://expense.<your-domain>`, and **returns only when the app
actually works**. `terraform destroy` removes everything.

All VMs run the course AMI `Redhat-9-DevOps-Practice` (RHEL 9). It uses
**password SSH, no key pair**: user `ec2-user`, password `DevOps321` (practice
credentials, set by the `ssh_user` / `ssh_password` variables). Application
only: the security groups already open the monitoring ports, but Prometheus,
Grafana and the exporters are installed by hand in class.

> **The ALB bills by the hour. Run `terraform destroy` at the end of every lab day.**

## Architecture

```
Internet ──HTTPS:443──▶ ALB  expense.<domain>  (ACM cert, HTTP→HTTPS redirect)
                          │ HTTP:80 (target group → frontend instance)
                          ▼
            expense-frontend   frontend.<domain>   nginx: React build, /api → backend.<domain>:8080
                          │
                          ▼
            expense-backend    backend.<domain>    Node.js API (systemd), DB_HOST=mysql.<domain>
                          │
                          ▼
            expense-mysql      mysql.<domain>      MySQL 8
```

**The VMs reach each other only through Route53 names.** Terraform creates an A
record per tier in your public hosted zone, pointing at the VM's private IP
(TTL 60 s):

| Record | Used by |
|---|---|
| `mysql.<domain>` | backend (`DB_HOST`) |
| `backend.<domain>` | frontend nginx (`proxy_pass`) |
| `frontend.<domain>` | nobody in the app; handy for SSH and Prometheus later |

No VM's userdata contains another VM's IP. So:
- Replacing one VM (for example `-replace=aws_instance.backend`) replaces **only that
  VM**. Its record is updated in place and the others keep working.
- nginx re-resolves `backend.<domain>` at request time (VPC resolver, variable
  `proxy_pass`), so it follows a replaced backend within about a minute.
- The records resolve to private addresses, so they only work inside the VPC.
- These record names belong to this stack. Terraform overwrites them if they
  already exist, so don't use them for anything else in the same zone.

The ALB is the only public entry point. It targets the frontend instance
directly (target groups take instances, not names).

## What gets created

45 resources: 38 in AWS, 7 Terraform-only (3 passwords, 4 readiness checks).
Every taggable AWS resource gets `Project=expense`, `Environment=lab`,
`ManagedBy=terraform`, plus `Name` and `Tier`.

| Area | Terraform resource | AWS name / value | Tier tag | Count |
|---|---|---|---|---|
| **Network** | `aws_vpc.main` | `expense-vpc` (10.0.0.0/16, DNS support on) | `network` | 1 |
| | `aws_subnet.public["a"]`, `["b"]` | `expense-public-a` (10.0.1.0/24), `expense-public-b` (10.0.2.0/24), two AZs | `network` | 2 |
| | `aws_internet_gateway.main` | `expense-igw` | `network` | 1 |
| | `aws_route_table.public` | `expense-public-rt` (0.0.0.0/0 → IGW) | `network` | 1 |
| | `aws_route_table_association.public` | both subnets → `expense-public-rt` | | 2 |
| **Security groups** | `aws_security_group.alb` | `expense-alb-sg` | `edge` | 1 |
| | `aws_security_group.frontend` | `expense-frontend-sg` | `frontend` | 1 |
| | `aws_security_group.backend` | `expense-backend-sg` | `backend` | 1 |
| | `aws_security_group.mysql` | `expense-mysql-sg` | `mysql` | 1 |
| | `aws_vpc_security_group_ingress_rule.*` | ALB 80, 443 from anywhere; frontend 80 from ALB SG; backend 8080 from frontend SG; mysql 3306 from backend SG; 22 from `admin_cidr` on each VM | | 8 |
| | `aws_vpc_security_group_ingress_rule.monitoring` | 9100 on every VM, 9113 frontend, 9101 backend, 9104 mysql; each from `admin_cidr`, the VPC CIDR and every `monitoring_cidrs` entry | | 12 (+6 per `monitoring_cidrs` entry) |
| | `aws_vpc_security_group_egress_rule.all` | all outbound, one per SG | | 4 |
| **VMs** | `aws_instance.frontend` | `expense-frontend`, `t3.micro`, 20 GB gp3, nginx + React build | `frontend` | 1 |
| | `aws_instance.backend` | `expense-backend`, `t3.micro`, 20 GB gp3, Node.js API | `backend` | 1 |
| | `aws_instance.mysql` | `expense-mysql`, `t3.micro`, 20 GB gp3, MySQL 8 | `mysql` | 1 |
| **Load balancer** | `aws_lb.main` | `expense-alb` (internet-facing, both subnets) | `edge` | 1 |
| | `aws_lb_target_group.frontend` | `expense-frontend-tg` (HTTP 80, health check `/healthz`) | `edge` | 1 |
| | `aws_lb_target_group_attachment.frontend` | frontend instance → target group | | 1 |
| | `aws_lb_listener.https` | 443, TLS 1.3/1.2 policy, forwards to the target group | `edge` | 1 |
| | `aws_lb_listener.http` | 80, 301 redirect to HTTPS | `edge` | 1 |
| **TLS** | `aws_acm_certificate.app` | certificate for `expense.<domain>` | `edge` | 1 |
| | `aws_route53_record.cert_validation` | ACM DNS-validation CNAME | | 1 |
| | `aws_acm_certificate_validation.app` | waits until ACM issues the certificate | | 1 |
| **DNS** (in your existing zone) | `aws_route53_record.app` | `expense.<domain>` → ALB (alias) | | 1 |
| | `aws_route53_record.frontend` | `frontend.<domain>` → frontend private IP | | 1 |
| | `aws_route53_record.backend` | `backend.<domain>` → backend private IP | | 1 |
| | `aws_route53_record.mysql` | `mysql.<domain>` → mysql private IP | | 1 |
| **Secrets** (Terraform only, not in AWS) | `random_password.mysql_root`, `.db_app`, `.jwt_secret` | MySQL root password, app DB password, JWT secret | | 3 |
| **Readiness** (Terraform only) | `terraform_data.vm_ready["frontend"/"backend"/"mysql"]` | SSH in, wait for setup, fail on `FAILURE` | | 3 |
| | `terraform_data.app_ready` | `https://expense.<domain>/api/health/ready` must answer 200 | | 1 |

**Read, not created:** the Route53 hosted zone (`data.aws_route53_zone`), the
AMI (`data.aws_ami.joindevops`) and the availability zones.

**Not created on purpose:** no NAT gateway, no EC2 key pair (password SSH), no
exporters or monitoring VM, no Auto Scaling group, no remote state.

**What costs money while it runs:** the ALB (hourly plus LCU), the three
t3.micro instances, their 20 GB gp3 volumes and the public IPv4 addresses
(ALB and instances). Route53 queries are cents. ACM public certificates are free.

## Prerequisites

- AWS credentials configured (`aws sts get-caller-identity` works).
- A **Route53 public hosted zone** for your domain, already delegated.
- Terraform ≥ 1.6.
- No SSH key needed: the course AMI uses `ec2-user` / `DevOps321`.
- The three app repos reachable over HTTPS (public), with the code on `main`.

## Apply

```bash
cp terraform.tfvars.example terraform.tfvars   # fill in domain, admin_cidr, repo URLs/refs
terraform init
terraform apply
```

Takes about 10–15 minutes. Apply finishes in this order:
1. Network, security groups, certificate (validated through Route53).
2. `mysql` VM → `mysql.<domain>` → `backend` VM → `backend.<domain>` →
   `frontend` VM. Each VM waits for its upstream's record to exist first:
   a lookup of a name that doesn't exist yet would be cached as "no such name"
   for up to 15 minutes.
3. Readiness: per VM, SSH in, wait for cloud-init, and fail if
   `/var/log/expense/setup.log` has a `FAILURE`.
4. End to end: from the frontend VM, `https://expense.<domain>/api/health/ready`
   must answer 200 within about 5 minutes, or the apply fails.

Outputs: `app_url`, `ssh_commands`, `tier_hostnames`, `private_ips`, and
(sensitive) `db_password`, `mysql_root_password`, `jwt_secret`:

```bash
terraform output ssh_commands      # ssh ec2-user@<public ip>, password DevOps321
terraform output -raw db_password
```

## Deploy new app code

Each VM clones its repo's `main` branch (`*_repo_ref`) once, when it is
created. New commits on `main` are **not** picked up automatically: Terraform
only sees that `"main"` hasn't changed. To redeploy a tier with the latest
`main`, rebuild just that VM:

```bash
terraform apply -replace=aws_instance.backend    # or .frontend / .mysql
```

Its Route53 record follows the new private IP and the other VMs are untouched.
Changing a `*_repo_ref` to another branch (or tag) and applying does the same.

Extra backend settings go in `backend_extra_env` (written as-is into
`/etc/expense/backend.env`, overriding earlier values):

```hcl
backend_extra_env = {
  ENABLE_DEBUG_API = "true"
  DEBUG_TOKEN      = "change-me-please"
}
```

The backend env file always gets `APP_REF=<backend_repo_ref>`, which the app
reports in `expense_backend_build_info`.

## On the VMs

| | frontend | backend | mysql |
|---|---|---|---|
| Hostname | `expense-frontend` | `expense-backend` | `expense-mysql` |
| App directory | `/opt/expense/frontend` (build), `/usr/share/nginx/html` (served) | `/opt/expense/backend` | `/opt/expense/mysql` (migrations) |
| Service | `nginx` | `expense-backend` (user `expense`) | `mysqld` |
| Config | `/etc/nginx/conf.d/expense.conf` | `/etc/expense/backend.env` (600) | `/etc/my.cnf.d/zz-expense.cnf` |
| Setup log | `/var/log/expense/setup.log` | same | same |

Monitoring ports are open from `admin_cidr`, the VPC CIDR (10.0.0.0/16) and
any `monitoring_cidrs`. Only 9101 (the backend's own `/metrics`) answers out of
the box; the others answer once you install that exporter:

| Port | What | VM |
|---|---|---|
| 9100 | node_exporter | all |
| 9101 | backend app metrics | backend |
| 9104 | mysqld_exporter | mysql |
| 9113 | nginx exporter | frontend |

On RHEL, firewalld is inactive on this AMI. If you turn it on, open the
exporter port there too.

## Destroy

```bash
terraform destroy
```

Removes everything, including the Route53 records it created. The hosted zone
itself is untouched.

## Troubleshooting

| Symptom | Look at |
|---|---|
| Apply fails at `terraform_data.vm_ready["<tier>"]` | The output shows the tail of that VM's `setup.log`. SSH in: `sudo less /var/log/expense/setup.log`, `sudo cloud-init status --long` |
| `clone ... FAILURE` | The repo URL is wrong or private, or the `*_repo_ref` branch doesn't exist on GitHub |
| Backend never ready | On the backend: `journalctl -u expense-backend -n 100`; `getent hosts mysql.<domain>`; on mysql: `systemctl status mysqld` |
| 502 from the app | On the frontend: `getent hosts backend.<domain>`, `curl -v http://backend.<domain>:8080/api/health/live`, `sudo tail /var/log/nginx/error.log` |
| Apply fails at `app_ready` | DNS or the ALB: `dig expense.<domain>`, target group health in the console |
| Certificate validation hangs | The hosted zone isn't the one your registrar delegates to (NS records mismatch) |
| `Error: no matching Route 53 Hosted Zone` | `domain_name` must be an existing public hosted zone in this account |
