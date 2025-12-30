#!/bin/bash

# =============================================================================
# WhatsApp CRM - Complete Server Fix Script
# =============================================================================
# This script fixes all critical issues found during deployment
# Run this on the server: bash SERVER_COMPLETE_FIX.sh
# =============================================================================

set -e  # Exit on error

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                                                               ║"
echo "║      🔧 WhatsApp CRM - Complete Server Fix                   ║"
echo "║                                                               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# =============================================================================
# Step 1: Pull Latest Code
# =============================================================================
echo -e "${YELLOW}[1/7] Pulling latest code from repository...${NC}"
cd ~/whatsapp-crm
git fetch origin
git checkout claude/whatsapp-crm-aws-setup-XATlw
git pull origin claude/whatsapp-crm-aws-setup-XATlw
echo -e "${GREEN}✅ Code updated${NC}"
echo ""

# =============================================================================
# Step 2: Backup Current .env
# =============================================================================
echo -e "${YELLOW}[2/7] Backing up current .env file...${NC}"
cd ~/whatsapp-crm/backend
if [ -f .env ]; then
    cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
    echo -e "${GREEN}✅ Backup created${NC}"
else
    echo -e "${RED}⚠️  No .env file found, will create new one${NC}"
fi
echo ""

# =============================================================================
# Step 3: Create/Update .env File
# =============================================================================
echo -e "${YELLOW}[3/7] Creating/updating .env file...${NC}"

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}Creating new .env file...${NC}"
    cp .env.example .env
fi

# Update or add critical environment variables
echo -e "${YELLOW}Updating environment variables...${NC}"

# Function to update or add env variable
update_env() {
    local key=$1
    local value=$2
    local file=".env"

    if grep -q "^${key}=" "$file" 2>/dev/null; then
        # Key exists, update it
        sed -i "s|^${key}=.*|${key}=${value}|" "$file"
    else
        # Key doesn't exist, add it
        echo "${key}=${value}" >> "$file"
    fi
}

# Critical fixes
update_env "NODE_ENV" "production"
update_env "PORT" "5000"
update_env "API_BASE_URL" "https://api.fynedtest.com"
update_env "WEBHOOK_BASE_URL" "http://172.17.0.1:5000"
update_env "EVOLUTION_API_URL" "http://localhost:8080"
update_env "EVOLUTION_API_KEY" "fynedtest-evolution-api-key-2024-secure"

# Check if Supabase credentials exist
if ! grep -q "^SUPABASE_URL=" .env 2>/dev/null; then
    echo -e "${RED}⚠️  SUPABASE_URL not found in .env${NC}"
    echo -e "${YELLOW}Please add Supabase credentials manually${NC}"
fi

echo -e "${GREEN}✅ Environment variables updated${NC}"
echo ""

# =============================================================================
# Step 4: Verify .env Configuration
# =============================================================================
echo -e "${YELLOW}[4/7] Verifying .env configuration...${NC}"

# Source .env and check critical variables
source .env

if [ -z "$PORT" ]; then
    echo -e "${RED}❌ PORT not set${NC}"
    exit 1
fi

if [ -z "$WEBHOOK_BASE_URL" ]; then
    echo -e "${RED}❌ WEBHOOK_BASE_URL not set${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Configuration verified${NC}"
echo "   - PORT: $PORT"
echo "   - WEBHOOK_BASE_URL: $WEBHOOK_BASE_URL"
echo "   - EVOLUTION_API_URL: $EVOLUTION_API_URL"
echo ""

# =============================================================================
# Step 5: Check Evolution API Status
# =============================================================================
echo -e "${YELLOW}[5/7] Checking Evolution API status...${NC}"

# Check if Evolution API is running
if curl -s http://localhost:8080/instance/fetchInstances \
    -H "apikey: fynedtest-evolution-api-key-2024-secure" > /dev/null; then
    echo -e "${GREEN}✅ Evolution API is running${NC}"
else
    echo -e "${RED}❌ Evolution API is NOT running${NC}"
    echo -e "${YELLOW}Starting Evolution API...${NC}"
    cd ~/whatsapp-crm/infrastructure/docker
    docker compose -f docker-compose.evolution.yml up -d
    sleep 5
    echo -e "${GREEN}✅ Evolution API started${NC}"
fi
echo ""

# =============================================================================
# Step 6: Clean Old Evolution Instances
# =============================================================================
echo -e "${YELLOW}[6/7] Cleaning old Evolution API instances...${NC}"

# Get all instances
instances=$(curl -s http://localhost:8080/instance/fetchInstances \
    -H "apikey: fynedtest-evolution-api-key-2024-secure" | jq -r '.[].instance.instanceName' 2>/dev/null || echo "")

if [ -n "$instances" ]; then
    echo "Found instances:"
    echo "$instances"

    # Ask to delete old instances
    echo -e "${YELLOW}These instances have incorrect webhook URLs.${NC}"
    echo -e "${YELLOW}Recommendation: Delete them and create new ones from frontend.${NC}"
    echo ""
    echo -e "${GREEN}You can delete them from the frontend after backend restarts.${NC}"
else
    echo -e "${GREEN}✅ No instances found${NC}"
fi
echo ""

# =============================================================================
# Step 7: Restart Backend
# =============================================================================
echo -e "${YELLOW}[7/7] Restarting backend with PM2...${NC}"

cd ~/whatsapp-crm/backend

# Check if PM2 process exists
if pm2 list | grep -q "whatsapp-backend"; then
    echo "Restarting existing PM2 process..."
    pm2 restart whatsapp-backend --update-env
else
    echo "Starting new PM2 process..."
    pm2 start src/server.js --name whatsapp-backend
fi

# Save PM2 configuration
pm2 save

echo -e "${GREEN}✅ Backend restarted${NC}"
echo ""

# =============================================================================
# Verification
# =============================================================================
echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                                                               ║"
echo "║      ✅ Server Fix Complete!                                 ║"
echo "║                                                               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

echo -e "${GREEN}Verification Steps:${NC}"
echo ""

# Wait for backend to start
sleep 3

# Check if backend is running on correct port
if netstat -tlnp 2>/dev/null | grep -q ":5000"; then
    echo -e "${GREEN}✅ Backend is running on port 5000${NC}"
else
    echo -e "${RED}❌ Backend is NOT running on port 5000${NC}"
    echo -e "${YELLOW}Check logs: pm2 logs whatsapp-backend${NC}"
fi

# Check PM2 status
echo ""
echo "PM2 Status:"
pm2 list

echo ""
echo -e "${GREEN}Next Steps:${NC}"
echo "1. Check logs: ${YELLOW}pm2 logs whatsapp-backend --lines 50${NC}"
echo "2. Verify webhook URL for new sessions will be: http://172.17.0.1:5000/api/webhooks/evolution"
echo "3. Delete old sessions from frontend (they have wrong webhook URLs)"
echo "4. Create new sessions and test QR code connection"
echo ""
echo -e "${GREEN}Expected behavior:${NC}"
echo "  - New session created → Webhook URL: http://172.17.0.1:5000/api/webhooks/evolution"
echo "  - QR code scanned → Session status changes to CONNECTED within 10 seconds"
echo ""
echo -e "${YELLOW}If issues persist, check:${NC}"
echo "  - pm2 logs whatsapp-backend"
echo "  - docker compose -f ~/whatsapp-crm/infrastructure/docker/docker-compose.evolution.yml logs"
echo ""
