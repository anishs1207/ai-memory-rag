# ==============================================================================
# Outputs Configuration for Inqora Infrastructure
# Date: 2026-07-28
# Description: Output definitions exposing endpoints, IPs, and DNS details.
# ==============================================================================

output "vpc_id" {
  description = "The ID of the primary Amazon VPC."
  value       = aws_vpc.main.id
}

output "alb_dns_name" {
  description = "The public DNS name of the Application Load Balancer."
  value       = aws_lb.main.dns_name
}

output "ec2_public_ip" {
  description = "The public IP address of the EC2 deployment server."
  value       = aws_instance.app_server.public_ip
}

output "rds_endpoint" {
  description = "The connection endpoint for the RDS PostgreSQL database."
  value       = aws_db_instance.postgres.endpoint
}

output "redis_endpoint" {
  description = "The endpoint address of the ElastiCache Redis cluster."
  value       = aws_elasticache_cluster.redis.cache_nodes[0].address
}

output "s3_bucket_name" {
  description = "The name of the S3 storage bucket created for assets."
  value       = aws_s3_bucket.assets.id
}

output "route53_nameservers" {
  description = "The authoritative nameservers for the Route53 hosted zone."
  value       = aws_route53_zone.primary.name_servers
}
