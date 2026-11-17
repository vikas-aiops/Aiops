provider "aws" {
  region = var.aws_region

  # Tags every taggable resource (naming-conventions §2.2). Name and Tier are
  # added per resource. Never rename these: EC2 service discovery depends on them.
  default_tags {
    tags = {
      Project     = var.project
      Environment = "lab"
      ManagedBy   = "terraform"
    }
  }
}
