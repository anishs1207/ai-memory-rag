#!/bin/bash
# ==============================================================================
# Inqora EC2 Host UserData Provisioning & Deployment Script
# Date: 2026-07-28
# Purpose: Bootstrap Docker environment, set system variables, deploy /apps
# ==============================================================================

set -e

# Log output to user-data log file for debugging
exec > >(tee /var/log/user-data.log|logger -t user-data -s 2>/dev/console) 2>&1

echo "==> Starting Inqora EC2 UserData Provisioning..."

# 1. Update system packages & install prerequisites
apt-get update -y
apt-get install -y \
  ca-certificates \
  curl \
  gnupg \
  lsb-release \
  git \
  awscli \
  jq

# 2. Install Docker & Docker Compose Plugin
mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin docker-buildx-plugin

# Enable and start Docker daemon
systemctl enable docker
systemctl start docker
usermod -aG docker ubuntu

# 3. Create application workspace directory
WORKDIR="/opt/inqora"
mkdir -p ${WORKDIR}

# 4. Write system environment file (/etc/inqora.env)
cat << 'EOF' > /etc/inqora.env
DATABASE_URL="${database_url}"
REDIS_HOST="${redis_host}"
REDIS_PORT=6379
S3_BUCKET_NAME="${s3_bucket_name}"
GEMINI_API_KEY="${gemini_api_key}"
NEXT_PUBLIC_API_URL="http://${alb_dns_name}:3001"
EOF

chmod 600 /etc/inqora.env

# 5. Create Systemd Service for Inqora Apps container management
cat << EOF > /etc/systemd/system/inqora-apps.service
[Unit]
Description=Inqora Microservices Docker Compose Application
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=${WORKDIR}
EnvironmentFile=/etc/inqora.env
ExecStart=/usr/bin/docker compose up -d --build
ExecStop=/usr/bin/docker compose down

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable inqora-apps.service

echo "==> Inqora EC2 UserData Provisioning Completed Successfully."
