# ==============================================================================
# Variables Configuration for Inqora Infrastructure
# Date: 2026-07-28
# Description: Input variables for AWS networking, database, compute, and DNS.
# ==============================================================================

variable "aws_region" {
  type        = string
  description = "The AWS region where resources will be deployed."
  default     = "us-east-1"
}

variable "environment" {
  type        = string
  description = "Deployment environment name (e.g., production, staging, dev)."
  default     = "production"
}

variable "domain_name" {
  type        = string
  description = "The primary domain name registered in Route53."
  default     = "inqora.internal"
}

variable "vpc_cidr_block" {
  type        = string
  description = "CIDR block allocated for the main VPC network."
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  type        = list(string)
  description = "CIDR blocks for public subnets spanning multiple Availability Zones."
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_subnet_cidrs" {
  type        = list(string)
  description = "CIDR blocks for private subnets spanning multiple Availability Zones."
  default     = ["10.0.10.0/24", "10.0.11.0/24"]
}

variable "ec2_instance_type" {
  type        = string
  description = "EC2 instance size used for running dockerized microservices."
  default     = "t3.medium"
}

variable "database_name" {
  type        = string
  description = "Name of the PostgreSQL database instance."
  default     = "agentic_db"
}

variable "database_username" {
  type        = string
  description = "Master username for PostgreSQL database access."
  default     = "inqora_admin"
}

variable "database_password" {
  type        = string
  description = "Master password for PostgreSQL database access."
  sensitive   = true
  default     = "InqoraSecurePass2026!"
}

variable "gemini_api_key" {
  type        = string
  description = "Gemini API Key passed to image-memory-be and RAG services."
  sensitive   = true
  default     = "placeholder_gemini_api_key"
}
