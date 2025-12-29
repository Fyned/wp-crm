# 🚀 Corporate WhatsApp CRM - Deployment Guide

Complete step-by-step deployment guide for production environment.

---

## 📋 Prerequisites

Before starting, ensure you have:

- ✅ AWS Account with EC2 access
- ✅ Supabase account (Free tier works for development)
- ✅ Domain name (for SSL certificates)
- ✅ SSH key pair for EC2 instances
- ✅ Basic knowledge of Linux, Docker, and networking

---

## 🗺️ Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                           AWS VPC                                │
│                                                                   │
│  ┌──────────────────┐         ┌──────────────────┐              │
│  │   EC2 Instance   │         │   EC2 Instance   │              │
│  │   WAHA Server    │◄────────┤   Backend API    │              │
│  │   (Private)      │         │   (Public)       │              │
│  └──────────────────┘         └──────────────────┘              │
│                                        │                          │
│                                        ▼                          │
└────────────────────────────────────────┼──────────────────────────┘
                                         │
                                         ▼
                              ┌──────────────────┐
                              │   Supabase       │
                              │   PostgreSQL     │
                              │   + Storage      │
                              └──────────────────┘
                                         ▲
                                         │
                              ┌──────────────────┐
                              │   Frontend       │
                              │   (Vercel/       │
                              │   Netlify)       │
                              └──────────────────┘
```

---

## PART 1: Supabase Setup

### 1.1 Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Click "Start your project" → "New Project"
3. Fill in:
   - **Name:** `whatsapp-crm`
   - **Database Password:** (Strong password - save it!)
   - **Region:** Closest to your users
4. Click "Create new project" (takes ~2 minutes)

### 1.2 Run Database Migrations

1. Go to **SQL Editor** in Supabase Dashboard
2. Click "New query"
3. Copy content from `/supabase/migrations/001_initial_schema.sql`
4. Click "Run" ▶️
5. Repeat for:
   - `002_row_level_security.sql`
   - `003_functions_and_triggers.sql`

### 1.3 Create Super Admin

1. Go to **Authentication** → **Users**
2. Click "Add user" → "Create new user"
3. Fill in:
   - **Email:** `superadmin@system.local`
   - **Password:** (Strong password)
   - **Auto Confirm Email:** ✅ Yes
4. Click "Create user"
5. Click on the created user → **User Metadata** → Add:

```json
{
  "username": "superadmin",
  "role": "super_admin"
}
```

6. Click "Save"

### 1.4 Configure Storage

1. Go to **Storage**
2. Bucket `whatsapp-media` should already exist (created by migration)
3. If not, create it: Click "New bucket" → Name: `whatsapp-media` → Public: OFF

### 1.5 Get API Keys

1. Go to **Settings** → **API**
2. Copy these values (you'll need them later):
   - **Project URL:** `https://xxxxx.supabase.co`
   - **anon public:** `eyJ...`
   - **service_role:** `eyJ...` (⚠️ Keep secret!)

---

## PART 2: AWS WAHA Server Setup

See [infrastructure/AWS_SETUP.md](./infrastructure/AWS_SETUP.md) for detailed AWS setup.

### Quick Steps:

1. **Launch EC2 instance** (t3.medium, Ubuntu 22.04)
2. **Configure Security Groups:**
   - Port 22 (SSH) - Your IP only
   - Port 80 (HTTP) - 0.0.0.0/0 (for Certbot)
   - Port 443 (HTTPS) - Backend EC2 only
3. **Install Docker:**

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker ubuntu
```

4. **Deploy WAHA:**

```bash
cd ~
git clone <your-repo> whatsapp-crm
cd whatsapp-crm/infrastructure/docker
cp .env.example .env
nano .env  # Edit configuration
docker compose up -d
```

5. **Setup SSL with Certbot:**

```bash
sudo certbot certonly --standalone -d waha.yourdomain.com
sudo cp /etc/letsencrypt/live/waha.yourdomain.com/*.pem ../ssl/
```

---

## PART 3: Backend API Deployment

### 3.1 Launch Backend EC2 Instance

1. **Instance Configuration:**
   - AMI: Ubuntu Server 22.04 LTS
   - Instance Type: t3.small (1 GB RAM minimum)
   - Storage: 20GB gp3
   - Security Group:
     - Port 22 (SSH) - Your IP
     - Port 5000 (API) - 0.0.0.0/0
     - Port 443 (HTTPS) - 0.0.0.0/0

2. **SSH into instance:**

```bash
ssh -i your-key.pem ubuntu@<backend-ec2-ip>
```

### 3.2 Install Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version  # Should be v20.x
```

### 3.3 Deploy Backend Code

```bash
# Clone repository
git clone <your-repo> whatsapp-crm
cd whatsapp-crm/backend

# Install dependencies
npm install --production

# Create .env file
cp .env.example .env
nano .env
```

### 3.4 Configure Environment Variables

Edit `.env`:

```env
NODE_ENV=production
PORT=5000
API_BASE_URL=https://api.yourdomain.com

# Supabase (from Part 1.5)
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# WAHA (from Part 2)
WAHA_BASE_URL=https://waha.yourdomain.com
WAHA_API_KEY=your-waha-api-key

# JWT (generate with: openssl rand -hex 32)
JWT_SECRET=<random-64-char-string>

# Security
ALLOWED_ORIGINS=https://yourdomain.com
```

### 3.5 Setup PM2 (Process Manager)

```bash
sudo npm install -g pm2

# Start application
pm2 start src/server.js --name whatsapp-crm-api

# Auto-restart on reboot
pm2 startup
pm2 save

# View logs
pm2 logs whatsapp-crm-api
```

### 3.6 Setup Nginx Reverse Proxy

```bash
sudo apt install -y nginx

# Create Nginx config
sudo nano /etc/nginx/sites-available/whatsapp-crm
```

Paste:

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

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
# Enable site
sudo ln -s /etc/nginx/sites-available/whatsapp-crm /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 3.7 Setup SSL for API

```bash
sudo certbot --nginx -d api.yourdomain.com
```

---

## PART 4: Frontend Deployment

### Option A: Deploy to Vercel (Recommended)

1. **Push code to GitHub**
2. **Go to [vercel.com](https://vercel.com)**
3. **Import your repository**
4. **Configure:**
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Root Directory: `frontend`
5. **Add Environment Variables:**

```env
VITE_API_URL=https://api.yourdomain.com
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

6. **Deploy** ✅

### Option B: Deploy to Netlify

Similar to Vercel:

1. **Connect GitHub repo**
2. **Build settings:**
   - Base directory: `frontend`
   - Build command: `npm run build`
   - Publish directory: `frontend/dist`
3. **Add environment variables**
4. **Deploy**

### Option C: Self-hosted with Nginx

```bash
# Build locally
cd frontend
npm install
npm run build

# Upload dist/ to server
scp -r dist/* ubuntu@server:/var/www/whatsapp-crm

# Nginx config
sudo nano /etc/nginx/sites-available/whatsapp-crm-frontend
```

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    root /var/www/whatsapp-crm;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/whatsapp-crm-frontend /etc/nginx/sites-enabled/
sudo certbot --nginx -d yourdomain.com
sudo systemctl restart nginx
```

---

## PART 5: Post-Deployment Configuration

### 5.1 Configure DNS

Point your domains to EC2 elastic IPs:

```
Type    Name                Value
A       yourdomain.com      <Frontend-IP>
A       api.yourdomain.com  <Backend-IP>
A       waha.yourdomain.com <WAHA-IP>
```

### 5.2 Test the System

1. **Access Frontend:** `https://yourdomain.com`
2. **Login** with super admin credentials
3. **Create a test user** (Admin panel)
4. **Create a session** (New Session button)
5. **Connect WhatsApp** (Scan QR or use pairing code)
6. **Send a test message**

### 5.3 Verify Webhook

Check backend logs to ensure WAHA webhooks are working:

```bash
pm2 logs whatsapp-crm-api
```

You should see:
```
[Webhook] Received event: message for session: xxx
[Webhook] Message saved: xxx
```

---

## 🔒 Security Checklist

- [ ] WAHA dashboard NOT publicly accessible
- [ ] Supabase service_role key NEVER exposed to frontend
- [ ] SSL certificates installed on all domains
- [ ] Firewall (UFW) enabled on EC2 instances
- [ ] Strong passwords for all accounts
- [ ] Regular backups enabled
- [ ] Environment variables not committed to git
- [ ] CORS properly configured

---

## 📊 Monitoring & Maintenance

### Logs

**Backend:**
```bash
pm2 logs whatsapp-crm-api
```

**WAHA:**
```bash
cd ~/whatsapp-crm/infrastructure/docker
docker compose logs -f waha
```

### Backups

**Database:**
```bash
# Via Supabase Dashboard
Settings → Database → Create backup
```

**WAHA Sessions:**
```bash
docker run --rm \
  -v whatsapp-crm_waha_sessions:/data \
  -v $(pwd)/backups:/backup \
  ubuntu tar czf /backup/sessions-$(date +%Y%m%d).tar.gz /data
```

### Updates

**Backend:**
```bash
cd ~/whatsapp-crm/backend
git pull
npm install
pm2 restart whatsapp-crm-api
```

**WAHA:**
```bash
cd ~/whatsapp-crm/infrastructure/docker
docker compose pull
docker compose up -d
```

---

## 🐛 Troubleshooting

### Issue: QR Code not loading

**Solution:**
```bash
# Check WAHA logs
docker compose logs waha

# Verify WAHA API key
curl -H "X-Api-Key: YOUR_KEY" https://waha.yourdomain.com/api/sessions
```

### Issue: Messages not syncing

**Solution:**
```bash
# Check webhook configuration
# Verify backend can reach WAHA
curl https://waha.yourdomain.com/health
```

### Issue: "Unauthorized" errors

**Solution:**
- Verify JWT_SECRET is set correctly
- Check Supabase keys in `.env`
- Ensure RLS policies are applied

---

## 📞 Support

- **Issues:** Create an issue on GitHub
- **Documentation:** See [README.md](./README.md)
- **Database Schema:** See [supabase/SCHEMA.md](./supabase/SCHEMA.md)

---

## 🎉 You're Done!

Your Corporate WhatsApp CRM is now live and ready for production use!

**Next Steps:**
1. Create admin users for your team
2. Set up WhatsApp sessions
3. Assign sessions to team members
4. Start managing conversations

**Built with ❤️ for enterprise communications**
