variable "aws_region" {
  description = "AWS region for every resource."
  type        = string
  default     = "us-east-1"
}

variable "project" {
  description = "Prefix for names and the Project tag. Keep the default."
  type        = string
  default     = "expense"
}

variable "domain_name" {
  description = "Existing Route53 PUBLIC hosted zone, e.g. joindevops.online. Holds the app record and the per-tier records the VMs use to reach each other."
  type        = string
}

variable "app_hostname" {
  description = "App FQDN = <app_hostname>.<domain_name>."
  type        = string
  default     = "expense"
}

variable "admin_cidr" {
  description = "CIDR allowed to SSH to the VMs, e.g. your own IP /32."
  type        = string

  validation {
    condition     = can(cidrhost(var.admin_cidr, 0)) && var.admin_cidr != "0.0.0.0/0"
    error_message = "admin_cidr must be a valid CIDR such as 203.0.113.10/32, and must not be 0.0.0.0/0."
  }
}

variable "monitoring_cidrs" {
  description = "Extra CIDRs allowed to scrape the exporter / metrics ports (e.g. a Prometheus server outside this VPC, as its public IP /32). admin_cidr and the VPC CIDR are always allowed."
  type        = list(string)
  default     = []

  validation {
    condition     = alltrue([for c in var.monitoring_cidrs : can(cidrhost(c, 0)) && c != "0.0.0.0/0"])
    error_message = "Each monitoring_cidrs entry must be a valid CIDR and must not be 0.0.0.0/0."
  }
}

# The course AMI (Redhat-9-DevOps-Practice) uses password SSH, no key pair.
# These are the AMI's practice credentials, not secrets. Used by the readiness
# checks and shown in the ssh_commands output.
variable "ssh_user" {
  description = "SSH user of the course AMI."
  type        = string
  default     = "ec2-user"
}

variable "ssh_password" {
  description = "SSH password of the course AMI (practice only)."
  type        = string
  default     = "DevOps321"
}

variable "frontend_instance_type" {
  type    = string
  default = "t3.micro"
}

variable "backend_instance_type" {
  type    = string
  default = "t3.micro"
}

variable "mysql_instance_type" {
  type    = string
  default = "t3.micro"
}

variable "node_version" {
  description = "Node.js major version installed via NodeSource."
  type        = string
  default     = "24"
}

variable "mysql_repo_url" {
  description = "Git URL of the mysql repo, e.g. https://github.com/<org>/expense-mysql-v1.git"
  type        = string
}

variable "mysql_repo_ref" {
  description = "Git branch (or tag) to deploy."
  type        = string
  default     = "main"
}

variable "backend_repo_url" {
  description = "Git URL of the backend repo, e.g. https://github.com/<org>/expense-backend-v1.git"
  type        = string
}

variable "backend_repo_ref" {
  description = "Git branch (or tag) to deploy."
  type        = string
  default     = "main"
}

variable "frontend_repo_url" {
  description = "Git URL of the frontend repo, e.g. https://github.com/<org>/expense-frontend-v1.git"
  type        = string
}

variable "frontend_repo_ref" {
  description = "Git branch (or tag) to deploy."
  type        = string
  default     = "main"
}

variable "backend_extra_env" {
  description = "Extra env vars written as-is into /etc/expense/backend.env (e.g. ENABLE_DEBUG_API, DEBUG_TOKEN, METRICS_PORT). They override earlier values."
  type        = map(string)
  default     = {}

  validation {
    condition     = alltrue([for k in keys(var.backend_extra_env) : can(regex("^[A-Z_][A-Z0-9_]*$", k))])
    error_message = "backend_extra_env keys must be UPPER_SNAKE_CASE environment variable names."
  }
}

variable "db_name" {
  type    = string
  default = "expense"
}

variable "db_user" {
  description = "MySQL application user."
  type        = string
  default     = "expense"
}
