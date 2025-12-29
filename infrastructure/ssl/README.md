# SSL Certificate Setup

## Automated SSL with Certbot (Recommended)

### 1. Install Certbot on EC2

```bash
sudo apt update
sudo apt install -y certbot python3-certbot-nginx
```

### 2. Generate SSL Certificate

```bash
sudo certbot --nginx -d waha.yourdomain.com
```

### 3. Auto-Renewal Setup

Certbot automatically installs a systemd timer. Verify:

```bash
sudo systemctl status certbot.timer
```

Test renewal:

```bash
sudo certbot renew --dry-run
```

### 4. Copy Certificates to Docker Volume

```bash
sudo cp /etc/letsencrypt/live/waha.yourdomain.com/fullchain.pem ./fullchain.pem
sudo cp /etc/letsencrypt/live/waha.yourdomain.com/privkey.pem ./privkey.pem
sudo chmod 644 *.pem
```

## Manual SSL (Development)

For local testing, generate self-signed certificate:

```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout privkey.pem \
  -out fullchain.pem \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=waha.local"
```

## Security Notes

- **NEVER** commit `.pem` files to git
- Rotate certificates every 90 days (Certbot handles this automatically)
- Use strong ciphers (TLSv1.2+)
- Monitor certificate expiration

## Troubleshooting

### Certificate Not Found

Ensure nginx container can read certificates:

```bash
ls -la infrastructure/ssl/
```

Permissions should be `644` or `600`.

### Certbot Challenges Failing

Make sure port 80 is accessible for HTTP-01 challenge:

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```
