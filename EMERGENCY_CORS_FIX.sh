#!/bin/bash

# =============================================================================
# EMERGENCY FIX - CORS Issue
# =============================================================================
# Backend is not accessible due to CORS misconfiguration
# Run this immediately: bash EMERGENCY_CORS_FIX.sh
# =============================================================================

echo "🚨 EMERGENCY CORS FIX"
echo ""

cd ~/whatsapp-crm/backend

# Backup current .env
if [ -f .env ]; then
    cp .env .env.backup.emergency.$(date +%Y%m%d_%H%M%S)
    echo "✅ Backup created"
fi

# Update ALLOWED_ORIGINS to include wp-crm.vercel.app
if grep -q "^ALLOWED_ORIGINS=" .env 2>/dev/null; then
    # Check if wp-crm.vercel.app is already there
    if grep "^ALLOWED_ORIGINS=" .env | grep -q "wp-crm.vercel.app"; then
        echo "✅ wp-crm.vercel.app already in ALLOWED_ORIGINS"
    else
        # Add wp-crm.vercel.app to existing ALLOWED_ORIGINS
        sed -i 's|^ALLOWED_ORIGINS=.*|ALLOWED_ORIGINS=http://localhost:5173,https://app.fynedtest.com,https://wp-crm.vercel.app|' .env
        echo "✅ Added wp-crm.vercel.app to ALLOWED_ORIGINS"
    fi
else
    # ALLOWED_ORIGINS doesn't exist, add it
    echo "ALLOWED_ORIGINS=http://localhost:5173,https://app.fynedtest.com,https://wp-crm.vercel.app" >> .env
    echo "✅ Created ALLOWED_ORIGINS with all domains"
fi

# Show current .env configuration
echo ""
echo "📋 Current Configuration:"
grep "^PORT=" .env || echo "❌ PORT not set"
grep "^ALLOWED_ORIGINS=" .env || echo "❌ ALLOWED_ORIGINS not set"
grep "^WEBHOOK_BASE_URL=" .env || echo "❌ WEBHOOK_BASE_URL not set"
grep "^API_BASE_URL=" .env || echo "❌ API_BASE_URL not set"

echo ""
echo "🔄 Restarting backend..."
pm2 restart whatsapp-backend --update-env

echo ""
echo "⏳ Waiting for backend to start..."
sleep 3

echo ""
echo "📊 Backend Status:"
pm2 list | grep whatsapp-backend

echo ""
echo "🧪 Testing backend..."
sleep 2

# Test if backend responds
if curl -s http://localhost:5000/api/auth/me -H "Authorization: Bearer test" > /dev/null 2>&1; then
    echo "✅ Backend is responding on port 5000"
else
    echo "❌ Backend is NOT responding on port 5000"
    echo "   Check logs: pm2 logs whatsapp-backend"
fi

echo ""
echo "✅ EMERGENCY FIX COMPLETE"
echo ""
echo "Next steps:"
echo "1. Check logs: pm2 logs whatsapp-backend --lines 30"
echo "2. Try logging in again at https://wp-crm.vercel.app"
echo "3. If still not working, check if api.fynedtest.com is pointing to this server"
echo ""
