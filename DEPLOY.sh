#!/bin/bash
# Quick deployment script for WhatsApp CRM bug fixes
# Run this on your production server (ubuntu@54.93.113.184)

set -e  # Exit on error

echo "🚀 WhatsApp CRM - Deploying bug fixes..."
echo ""

# Step 1: Pull latest code
echo "📥 Step 1: Pulling latest code..."
cd /home/ubuntu/whatsapp-crm
git fetch origin claude/message-reconnect-gap-fill-z5U5W
git pull origin claude/message-reconnect-gap-fill-z5U5W
echo "✅ Code updated!"
echo ""

# Step 2: Restart backend
echo "🔄 Step 2: Restarting backend..."
cd backend
pm2 restart whatsapp-backend
echo "✅ Backend restarted!"
echo ""

# Step 3: Show logs
echo "📋 Step 3: Checking logs..."
pm2 logs whatsapp-backend --lines 20 --nostream
echo ""

echo "✅ Deployment complete!"
echo ""
echo "⚠️  IMPORTANT: You MUST clean the database manually:"
echo "   1. Go to Supabase Dashboard → SQL Editor"
echo "   2. Run: TRUNCATE TABLE messages CASCADE;"
echo "   3. Run: UPDATE contacts SET name = NULL WHERE name = 'Musa Kerem Demirci';"
echo "   4. Then click 'Sync' in the frontend"
echo ""
