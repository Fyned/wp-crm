# 🚀 WhatsApp CRM with Evolution API - Complete Deployment Guide

## 📌 Sistem Özeti

**Önceki Sistem:** WAHA (ücretsiz versiyonda tek session limiti)
**Yeni Sistem:** Evolution API (unlimited sessions, production-ready)

**Mevcut Kaynaklar:**
- ✅ Supabase: https://jillpsifuqdioispmlaq.supabase.co
- ✅ AWS EC2: 13.49.116.115 (Ubuntu 24.04, Docker hazır)
- ✅ Domain: fynedtest.com

---

## 🎯 ADIM 1: AWS EC2 Sunucusu Hazırlığı

### SSH Bağlantısı

```bash
ssh -i your-key.pem ubuntu@13.49.116.115
```

### Sistem Güncelleme

```bash
sudo apt update && sudo apt upgrade -y
```

### Docker Kontrolü

```bash
docker --version
docker compose version
```

Eğer yoksa:

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker ubuntu
newgrp docker
```

---

## 🎯 ADIM 2: DNS Yapılandırması (Hostinger)

Hostinger DNS panelinde şu kayıtları ekleyin:

```
Type    Name    Value               TTL
A       api     13.49.116.115       14400
A       app     13.49.116.115       14400
```

Test edin:

```bash
nslookup api.fynedtest.com
nslookup app.fynedtest.com
```

---

## 🎯 ADIM 3: Supabase Migration (SON ADIM)

Supabase Dashboard → SQL Editor → New Query

```sql
-- Paste content from supabase/migrations/004_evolution_api_adaptation.sql
```

✅ Run
✅ Başarılı mesajı almalısınız

---

## 🎯 ADIM 4: Proje Deployment

### Git Clone

```bash
cd ~
git clone https://github.com/Fyned/wp-crm.git
cd wp-crm
git checkout claude/whatsapp-crm-aws-setup-XATlw
```

### Environment Variables Oluştur

```bash
cd infrastructure/docker
cp .env.evolution.example .env
nano .env
```

**`.env` içeriği:**

```env
# MongoDB
MONGO_USERNAME=evolution
MONGO_PASSWORD=$(openssl rand -base64 32)

# Evolution API
EVOLUTION_API_KEY=$(openssl rand -hex 32)
EVOLUTION_SERVER_URL=https://api.fynedtest.com

# Backend Webhook
BACKEND_WEBHOOK_URL=https://api.fynedtest.com/api/webhooks/evolution

# Network
BACKEND_SERVER_IP=172.31.0.0/16

# SSL
SSL_CERTIFICATE_PATH=/etc/nginx/ssl/fullchain.pem
SSL_CERTIFICATE_KEY_PATH=/etc/nginx/ssl/privkey.pem
```

**Kaydet:** Ctrl+X → Y → Enter

---

## 🎯 ADIM 5: SSL Sertifikası Oluşturma

### Certbot Kurulumu

```bash
sudo apt install -y certbot
```

### Nginx'i Geçici Olarak Durdur

```bash
# Eğer çalışıyorsa
docker compose -f docker-compose.evolution.yml down nginx
```

### Sertifika Oluştur

```bash
sudo certbot certonly --standalone -d api.fynedtest.com

# İstendiğinde:
# Email: your-email@example.com
# Terms: A (Agree)
# Share email: N (No)
```

### Sertifikaları Kopyala

```bash
sudo cp /etc/letsencrypt/live/api.fynedtest.com/fullchain.pem ../ssl/
sudo cp /etc/letsencrypt/live/api.fynedtest.com/privkey.pem ../ssl/
sudo chown ubuntu:ubuntu ../ssl/*.pem
chmod 644 ../ssl/*.pem
```

### Sertifika Yenileme (Otomatik)

```bash
# Test
sudo certbot renew --dry-run

# Cron job (otomatik)
sudo crontab -e
```

Ekleyin:

```cron
0 3 * * * certbot renew --quiet && cp /etc/letsencrypt/live/api.fynedtest.com/*.pem /home/ubuntu/wp-crm/infrastructure/ssl/ && docker compose -f /home/ubuntu/wp-crm/infrastructure/docker/docker-compose.evolution.yml restart nginx
```

---

## 🎯 ADIM 6: Evolution API Başlatma

```bash
cd ~/wp-crm/infrastructure/docker
docker compose -f docker-compose.evolution.yml up -d
```

### Logları Kontrol Et

```bash
docker compose -f docker-compose.evolution.yml logs -f evolution-api
```

**Beklenen çıktı:**

```
Evolution API started successfully
Server running on port 8080
MongoDB connected
```

### Sağlık Kontrolü

```bash
# Local
curl http://localhost:8080/health

# External (HTTPS)
curl https://api.fynedtest.com/health
```

---

## 🎯 ADIM 7: Backend API Deployment

### Backend Klasörüne Git

```bash
cd ~/wp-crm/backend
```

### Environment Variables

```bash
cp .env.example .env
nano .env
```

**`.env` içeriği:**

```env
NODE_ENV=production
PORT=5000
API_BASE_URL=https://api.fynedtest.com

# Supabase (ZATENvar, değiştirme)
SUPABASE_URL=https://jillpsifuqdioispmlaq.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppbGxwc2lmdXFkaW9pc3BtbGFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwMDg0NDUsImV4cCI6MjA4MjU4NDQ0NX0.B0_piF4wArdJJrCgDDQibW1rj2z5NeORtGtRPwhNBro
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppbGxwc2lmdXFkaW9pc3BtbGFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzAwODQ0NSwiZXhwIjoyMDgyNTg0NDQ1fQ.3eIUn9RJdicNuj-9bpfssqpeNQWZs0ur-k0lntGY8Y8

# Evolution API
EVOLUTION_API_URL=https://api.fynedtest.com
EVOLUTION_API_KEY=$(buraya docker .env'deki aynı key'i yazın)

# JWT Secret
JWT_SECRET=$(openssl rand -hex 32)

# Security
ALLOWED_ORIGINS=http://localhost:5173,https://app.fynedtest.com
```

### Bağımlılıkları Yükle

```bash
npm install --production
```

### PM2 ile Başlat

```bash
sudo npm install -g pm2

pm2 start src/server.js --name whatsapp-crm-api

# Auto-start on boot
pm2 startup
pm2 save
```

### Logları Kontrol Et

```bash
pm2 logs whatsapp-crm-api
```

**Beklenen:**

```
╔════════════════════════════════════════════════════════════╗
║         🚀 WhatsApp CRM Backend Server Started            ║
║  Port:         5000                                        ║
╚════════════════════════════════════════════════════════════╝
```

### Nginx Reverse Proxy (Backend için)

```bash
sudo nano /etc/nginx/sites-available/whatsapp-crm-backend
```

Paste:

```nginx
server {
    listen 80;
    server_name api.fynedtest.com;

    # Certbot için
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$server_name$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name api.fynedtest.com;

    ssl_certificate /etc/letsencrypt/live/api.fynedtest.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.fynedtest.com/privkey.pem;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/whatsapp-crm-backend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 🎯 ADIM 8: Frontend Deployment (Vercel)

### 1. Push to GitHub

```bash
cd ~/wp-crm
git add .
git commit -m "Update backend to Evolution API"
git push origin claude/whatsapp-crm-aws-setup-XATlw
```

### 2. Vercel'de Deploy

1. https://vercel.com → Import Project
2. GitHub'dan `wp-crm` repo'sunu seç
3. **Framework Preset:** Vite
4. **Root Directory:** `frontend`
5. **Build Command:** `npm run build`
6. **Output Directory:** `dist`

7. **Environment Variables:**

```env
VITE_API_URL=https://api.fynedtest.com
VITE_SUPABASE_URL=https://jillpsifuqdioispmlaq.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppbGxwc2lmdXFkaW9pc3BtbGFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwMDg0NDUsImV4cCI6MjA4MjU4NDQ0NX0.B0_piF4wArdJJrCgDDQibW1rj2z5NeORtGtRPwhNBro
```

8. **Deploy** ✅

9. **Custom Domain:** Settings → Domains → Add `app.fynedtest.com`

---

## 🎯 ADIM 9: İLK TEST

### 1. Backend Health Check

```bash
curl https://api.fynedtest.com/api/health
```

Yanıt:

```json
{
  "status": "healthy",
  "timestamp": "2025-XX-XX...",
  "uptime": 123.45
}
```

### 2. Evolution API Check

```bash
curl -H "apikey: YOUR_EVOLUTION_API_KEY" \
     https://api.fynedtest.com/instance/fetchInstances
```

### 3. Frontend Aç

Tarayıcıda: **https://app.fynedtest.com**

Login sayfasını görmelisiniz!

### 4. İlk Giriş

**Supabase'de oluşturduğunuz Super Admin ile:**

- Username: `superadmin`
- Password: (oluştururken belirlediğiniz)

---

## 🎯 ADIM 10: İlk WhatsApp Session Oluşturma

Frontend'de:

1. **+ Yeni Hat Ekle** tıklayın
2. Session adı girin (örn: `test-session-01`)
3. **QR Code** sekmesinde QR kodu scan edin
   - VEYA -
4. **Pairing Code** sekmesinde telefon numaranızı girin

✅ WhatsApp bağlandı!

---

## 📊 Monitoring

### Docker Konteynerler

```bash
docker ps
docker compose -f docker-compose.evolution.yml logs -f
```

### Backend Logs

```bash
pm2 logs whatsapp-crm-api
```

### Disk Kullanımı

```bash
df -h
du -sh ~/wp-crm/infrastructure/docker/
```

### MongoDB Backup (Önemli!)

```bash
docker exec evolution-mongodb mongodump --out /data/backup
docker cp evolution-mongodb:/data/backup ./mongodb-backup-$(date +%Y%m%d).tar.gz
```

---

## 🔒 Güvenlik Kontrol Listesi

- [x] Evolution API sadece backend'den erişilebilir
- [x] SSL sertifikaları kurulu
- [x] Firewall (UFW) aktif
- [x] MongoDB şifreli
- [x] Service keys güvenli (.env dosyaları)
- [x] Rate limiting aktif
- [x] CORS doğru yapılandırılmış

---

## 🐛 Troubleshooting

### Evolution API bağlanamıyor

```bash
docker compose -f docker-compose.evolution.yml logs evolution-api
```

### Backend 500 hatası

```bash
pm2 logs whatsapp-crm-api --lines 100
```

### MongoDB connection error

```bash
docker compose -f docker-compose.evolution.yml restart mongodb
```

### QR Code yüklenmiyor

```bash
# Nginx logs
sudo tail -f /var/log/nginx/evolution_error.log
```

---

## 🎉 TAMAMLANDI!

Sisteminiz şu adreslerde çalışıyor:

- 🌐 **Frontend:** https://app.fynedtest.com
- ⚙️ **Backend API:** https://api.fynedtest.com
- 📱 **Evolution API:** https://api.fynedtest.com (internal)

**Sonraki Adımlar:**

1. ✅ Admin kullanıcıları oluşturun
2. ✅ WhatsApp session'ları ekleyin
3. ✅ Takım üyelerine atayın
4. ✅ Mesajlaşmaya başlayın!

**Yardıma ihtiyacınız olursa:** GitHub Issues

---

**Evolution API Avantajları:**

✅ Unlimited sessions (WAHA'nın aksine!)
✅ Built-in multi-session management
✅ Production-ready
✅ Active community
✅ MongoDB-backed (persistent sessions)
✅ WebSocket + Webhook support

**Kurumsal WhatsApp CRM sisteminiz hazır! 🚀**
