# AWS EC2 Setup Guide for WAHA Instance

## 📋 Prerequisites

- AWS Account with EC2 access
- Domain name configured in Route 53 (or external DNS)
- SSH key pair for EC2 access

## 🚀 Step-by-Step Setup

### 1. Launch EC2 Instance

**Instance Configuration:**

- **AMI**: Ubuntu Server 22.04 LTS
- **Instance Type**: t3.medium (2 vCPU, 4GB RAM) - **Minimum recommended**
- **Storage**: 30GB gp3 SSD
- **Key Pair**: Create or select existing SSH key

### 2. Security Group Configuration

Create security group named `waha-security-group`:

| Type  | Protocol | Port Range | Source          | Description                    |
|-------|----------|------------|-----------------|--------------------------------|
| SSH   | TCP      | 22         | Your IP/32      | SSH access from your office    |
| HTTP  | TCP      | 80         | 0.0.0.0/0       | Certbot SSL verification       |
| HTTPS | TCP      | 443        | Backend SG Only | WAHA API (Backend access only) |

**Critical Security Rules:**

```hcl
# Allow HTTPS only from Backend EC2
resource "aws_security_group_rule" "waha_https_from_backend" {
  type                     = "ingress"
  from_port                = 443
  to_port                  = 443
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.backend_sg.id
  security_group_id        = aws_security_group.waha_sg.id
}
```

### 3. Install Docker & Docker Compose

SSH into your EC2 instance:

```bash
ssh -i your-key.pem ubuntu@your-waha-ec2-ip
```

Install Docker:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker ubuntu
newgrp docker

# Install Docker Compose
sudo apt install -y docker-compose-plugin

# Verify installation
docker --version
docker compose version
```

### 4. Deploy WAHA

Clone and configure:

```bash
# Create directory
mkdir -p ~/whatsapp-crm
cd ~/whatsapp-crm

# Copy docker-compose.yml from your repository
# Or use SCP to transfer files
```

Create `.env` file:

```bash
nano infrastructure/docker/.env
```

```env
WAHA_API_KEY=$(openssl rand -hex 32)
WEBHOOK_URL=https://your-backend-domain.com/api/webhooks/waha
BACKEND_SERVER_IP=10.0.2.0/24  # Your backend VPC subnet
```

### 5. Configure DNS

Point your domain to EC2:

```bash
# In Route 53 or your DNS provider
waha.yourdomain.com -> A Record -> EC2_PUBLIC_IP
```

### 6. Setup SSL Certificate

```bash
# Install Certbot
sudo apt install -y certbot

# Stop nginx temporarily (if running)
docker compose -f infrastructure/docker/docker-compose.yml down nginx

# Generate certificate
sudo certbot certonly --standalone -d waha.yourdomain.com

# Copy certificates
sudo cp /etc/letsencrypt/live/waha.yourdomain.com/fullchain.pem \
   infrastructure/ssl/fullchain.pem
sudo cp /etc/letsencrypt/live/waha.yourdomain.com/privkey.pem \
   infrastructure/ssl/privkey.pem

sudo chown ubuntu:ubuntu infrastructure/ssl/*.pem
chmod 644 infrastructure/ssl/*.pem
```

### 7. Update Nginx Configuration

Edit `infrastructure/nginx/conf.d/waha.conf`:

```nginx
geo $backend_server_allowed {
    default 0;
    # Replace with your actual Backend EC2 private IP
    10.0.2.15/32 1;  # Example: Backend EC2 private IP
}
```

### 8. Launch Services

```bash
cd ~/whatsapp-crm
docker compose -f infrastructure/docker/docker-compose.yml up -d

# Check status
docker compose -f infrastructure/docker/docker-compose.yml ps

# View logs
docker compose -f infrastructure/docker/docker-compose.yml logs -f
```

### 9. Verify Installation

```bash
# Health check
curl http://localhost/health

# WAHA API (from backend server only)
curl -H "X-Api-Key: YOUR_WAHA_API_KEY" \
     https://waha.yourdomain.com/api/sessions
```

## 🔐 Security Hardening

### Enable UFW Firewall

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP (Certbot)
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

### Setup Auto-Updates

```bash
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

### Configure CloudWatch Logs (Optional)

```bash
# Install CloudWatch agent
wget https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
sudo dpkg -i amazon-cloudwatch-agent.deb

# Configure to send Docker logs to CloudWatch
```

## 📊 Monitoring

### Docker Container Health

```bash
# Check container status
docker ps

# View resource usage
docker stats

# Check logs
docker logs waha-engine
docker logs nginx-proxy
```

### Disk Space Monitoring

```bash
# Add cron job to clean old logs
crontab -e
```

```cron
# Clean Docker logs weekly
0 0 * * 0 docker system prune -f
```

## 🔄 Maintenance

### Update WAHA

```bash
cd ~/whatsapp-crm
docker compose -f infrastructure/docker/docker-compose.yml pull
docker compose -f infrastructure/docker/docker-compose.yml up -d
```

### Backup Session Data

```bash
# Backup WAHA sessions
docker run --rm \
  -v whatsapp-crm_waha_sessions:/data \
  -v $(pwd)/backups:/backup \
  ubuntu tar czf /backup/waha-sessions-$(date +%Y%m%d).tar.gz /data
```

### Restore Sessions

```bash
# Restore from backup
docker run --rm \
  -v whatsapp-crm_waha_sessions:/data \
  -v $(pwd)/backups:/backup \
  ubuntu tar xzf /backup/waha-sessions-YYYYMMDD.tar.gz -C /
```

## ⚠️ Troubleshooting

### WAHA Not Starting

```bash
# Check logs
docker logs waha-engine

# Verify API key
docker exec waha-engine env | grep WAHA_API_KEY
```

### SSL Certificate Issues

```bash
# Renew certificate manually
sudo certbot renew

# Copy new certificates
sudo cp /etc/letsencrypt/live/waha.yourdomain.com/*.pem infrastructure/ssl/

# Reload nginx
docker compose -f infrastructure/docker/docker-compose.yml restart nginx
```

### Connection Refused from Backend

```bash
# Verify security group allows backend IP
# Check nginx geo block configuration
# Test from backend server:
curl -H "X-Api-Key: YOUR_KEY" https://waha.yourdomain.com/api/sessions
```

## 💰 Cost Optimization

- Use **t3.medium** spot instances (save ~70%)
- Enable auto-shutdown during non-business hours
- Use AWS Backup for automated snapshots
- Monitor with AWS Cost Explorer

## 📞 Support

For WAHA-specific issues, see: https://github.com/devlikeapro/waha
