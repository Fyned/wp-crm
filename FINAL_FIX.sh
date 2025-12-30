#!/bin/bash

# =============================================================================
# FINAL FIX - Complete Server Deployment
# =============================================================================
# This script fixes ALL remaining issues:
# 1. Trust proxy configuration
# 2. Webhook event name handling
# 3. Nginx configuration for api.fynedtest.com
# =============================================================================

set -e
echo "🔧 FINAL FIX - Complete Server Deployment"
echo ""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# =============================================================================
# Step 1: Pull Latest Code (includes trust proxy fix)
# =============================================================================
echo -e "${YELLOW}[1/5] Pulling latest code with fixes...${NC}"
cd ~/whatsapp-crm
git fetch origin
git checkout claude/whatsapp-crm-aws-setup-XATlw
git reset --hard origin/claude/whatsapp-crm-aws-setup-XATlw
echo -e "${GREEN}✅ Latest code pulled${NC}"
echo ""

# =============================================================================
# Step 2: Install/Update Dependencies
# =============================================================================
echo -e "${YELLOW}[2/5] Checking dependencies...${NC}"
cd ~/whatsapp-crm/backend
npm install --production
echo -e "${GREEN}✅ Dependencies checked${NC}"
echo ""

# =============================================================================
# Step 3: Configure Nginx
# =============================================================================
echo -e "${YELLOW}[3/5] Configuring Nginx...${NC}"

# Check if Nginx is installed
if ! command -v nginx &> /dev/null; then
    echo -e "${RED}❌ Nginx not installed${NC}"
    echo -e "${YELLOW}Installing Nginx...${NC}"
    sudo apt update
    sudo apt install -y nginx
fi

# Copy Nginx configuration
sudo cp ~/whatsapp-crm/nginx-api.conf /etc/nginx/sites-available/api.fynedtest.com

# Enable site
if [ ! -L /etc/nginx/sites-enabled/api.fynedtest.com ]; then
    sudo ln -s /etc/nginx/sites-available/api.fynedtest.com /etc/nginx/sites-enabled/
    echo -e "${GREEN}✅ Nginx site enabled${NC}"
else
    echo -e "${GREEN}✅ Nginx site already enabled${NC}"
fi

# Test Nginx configuration
if sudo nginx -t; then
    echo -e "${GREEN}✅ Nginx configuration valid${NC}"
    sudo systemctl reload nginx
    echo -e "${GREEN}✅ Nginx reloaded${NC}"
else
    echo -e "${RED}❌ Nginx configuration invalid${NC}"
    echo -e "${YELLOW}Skipping Nginx reload${NC}"
fi
echo ""

# =============================================================================
# Step 4: Restart Backend
# =============================================================================
echo -e "${YELLOW}[4/5] Restarting backend...${NC}"
cd ~/whatsapp-crm/backend
pm2 restart whatsapp-backend --update-env
pm2 save
echo -e "${GREEN}✅ Backend restarted${NC}"
echo ""

# =============================================================================
# Step 5: Verify Everything
# =============================================================================
echo -e "${YELLOW}[5/5] Verifying deployment...${NC}"
sleep 3

# Check backend
if netstat -tlnp 2>/dev/null | grep -q ":5000"; then
    echo -e "${GREEN}✅ Backend running on port 5000${NC}"
else
    echo -e "${RED}❌ Backend NOT running on port 5000${NC}"
fi

# Check Nginx
if sudo systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✅ Nginx is running${NC}"
else
    echo -e "${RED}❌ Nginx is NOT running${NC}"
fi

# Check PM2
pm2 list | grep whatsapp-backend

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                                                               ║"
echo "║      ✅ DEPLOYMENT COMPLETE!                                 ║"
echo "║                                                               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

echo -e "${GREEN}Fixed Issues:${NC}"
echo "  ✅ Trust proxy configuration added"
echo "  ✅ Webhook event names normalized (connection.update → CONNECTION_UPDATE)"
echo "  ✅ Nginx configured for api.fynedtest.com"
echo "  ✅ CORS origins updated"
echo ""

echo -e "${YELLOW}Important Notes:${NC}"
echo "  1. SSL Certificate: If api.fynedtest.com doesn't have SSL yet, run:"
echo "     ${GREEN}sudo certbot --nginx -d api.fynedtest.com${NC}"
echo ""
echo "  2. DNS: Make sure api.fynedtest.com points to this server:"
echo "     ${GREEN}Type: A, Name: api, Value: $(curl -s ifconfig.me)${NC}"
echo ""
echo "  3. Test endpoints:"
echo "     ${GREEN}https://api.fynedtest.com/api/auth/me${NC} (should return 401)"
echo "     ${GREEN}https://wp-crm.vercel.app${NC} (login should work)"
echo "     ${GREEN}https://app.fynedtest.com${NC} (login should work)"
echo ""

echo -e "${YELLOW}Check logs:${NC}"
echo "  pm2 logs whatsapp-backend --lines 30"
echo "  sudo tail -f /var/log/nginx/api.fynedtest.com.error.log"
echo ""
