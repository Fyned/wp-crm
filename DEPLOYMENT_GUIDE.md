# Evolution API Bug Fix - Deployment Guide

## Problem Summary

**Evolution API v1.8.4** has a critical bug where the `/chat/findMessages` endpoint **ignores the `remoteJid` filter** and returns ALL messages instead of filtering by chat.

**Result:** During initial sync, all chats received the same messages (from contact 905050969166@s.whatsapp.net), causing data corruption.

**GitHub Issue:** https://github.com/EvolutionAPI/evolution-api/issues/1632

---

## Fix Applied

### Client-Side Filtering Workaround

Modified `backend/src/config/evolution.js`:
- `getChatMessages()` now fetches 10x more messages than needed
- Filters messages client-side by matching `key.remoteJid`
- Sorts by timestamp and limits to requested number
- Adds detailed logging for debugging

**This is a temporary workaround.** Recommended permanent fix: **Upgrade Evolution API to v2.3.7**

---

## Deployment Steps

### 1️⃣ Stop Current Sync (Important!)

The corrupted sync is still running. Stop it by restarting the backend:

```bash
ssh ubuntu@54.93.113.184
cd /home/ubuntu/whatsapp-crm/backend
pm2 restart whatsapp-backend
```

### 2️⃣ Pull Latest Code

```bash
cd /home/ubuntu/whatsapp-crm
git fetch origin claude/message-reconnect-gap-fill-z5U5W
git pull origin claude/message-reconnect-gap-fill-z5U5W
```

### 3️⃣ Clean Corrupted Messages

Run the database cleanup migration:

```bash
# Connect to Supabase SQL Editor or use psql
# Run the migration: supabase/migrations/999_cleanup_corrupted_messages.sql

# OR use Supabase CLI:
cd /home/ubuntu/whatsapp-crm
npx supabase db push
```

**Alternative:** Manually delete recent messages via SQL:

```sql
DELETE FROM messages WHERE created_at > NOW() - INTERVAL '24 hours';
```

### 4️⃣ Restart Backend with Fix

```bash
cd /home/ubuntu/whatsapp-crm/backend
pm2 restart whatsapp-backend
pm2 logs whatsapp-backend --lines 50
```

### 5️⃣ Test Initial Sync

1. Open frontend: http://your-frontend-url
2. Select session
3. Click "Sync" button → Choose "Initial sync"
4. Check PM2 logs for new behavior:

```bash
pm2 logs whatsapp-backend --lines 100
```

**Expected logs:**
```
[Evolution API] Fetching messages for 905448709358@s.whatsapp.net (with client-side filter workaround)
[Evolution API] Received 500 messages from API
[Evolution API] Filtered to 87 messages for 905448709358@s.whatsapp.net
[Evolution API] Returning 10 most recent messages
```

### 6️⃣ Verify Messages

Check that each chat now shows its OWN messages, not messages from 905050969166.

---

## Long-Term Recommendations

### ⚠️ Option 1: Upgrade Evolution API (Recommended)

Your current version: **v1.8.4** (very outdated)
Latest stable version: **v2.3.7**

**Benefits:**
- Proper message filtering (bug fixed)
- Better performance
- Security updates
- Message handling improvements

**Upgrade Guide:**
```bash
# Backup your Evolution API data first!
# Follow Evolution API upgrade docs:
# https://github.com/EvolutionAPI/evolution-api/releases
```

### Option 2: Use Webhooks Instead

Instead of syncing from Evolution API's internal database, capture messages in real-time via webhooks:

- More reliable
- No sync delays
- No pagination issues
- Real-time message updates

*This can be implemented if needed.*

---

## Troubleshooting

### Issue: Sync still returns wrong messages

**Check:**
1. Did you restart PM2 after pulling code?
2. Are you running the latest commit (214b9ce)?
3. Check logs for "with client-side filter workaround" message

### Issue: Sync is slow

**Expected:** Client-side filtering is slower than proper API filtering.

- Each chat fetches 500 messages instead of 10
- Evolution API v1.8.4 has slow response times
- **Solution:** Upgrade to v2.3.7

### Issue: Some messages still missing

Evolution API v1.8.4 may have other bugs. Check:
- API timeout errors in logs
- Missing messages in Evolution API's database
- **Solution:** Upgrade to v2.3.7

---

## Questions?

Contact: [Your contact info]

**Related Issues:**
- [Evolution API #1632](https://github.com/EvolutionAPI/evolution-api/issues/1632) - remoteJid filter bug
- [Evolution API Releases](https://github.com/EvolutionAPI/evolution-api/releases) - Latest versions
