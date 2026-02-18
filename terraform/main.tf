terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    key = "sengrok/terraform.tfstate"
  }
}

# Deploy with: tofu init && tofu apply

provider "aws" {
  region = var.region
}

data "aws_caller_identity" "current" {}
