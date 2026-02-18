variable "region" {
  description = "AWS region to deploy to"
  type        = string
  default     = "us-east-2"
}

variable "stage" {
  description = "Deployment stage"
  type        = string
  default     = "dev"
}

variable "service_name" {
  description = "Service name prefix"
  type        = string
  default     = "sengrok"
}
