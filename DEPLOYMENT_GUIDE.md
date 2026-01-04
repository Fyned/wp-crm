# WhatsApp CRM - Bug Fixes Deployment Guide

## Problems Fixed

### 🐛 Problem 1: Evolution API Message Filter Bug
**Evolution API v1.8.4** has a critical bug where `/chat/findMessages` endpoint **ignores the `remoteJid` filter** and returns ALL messages instead of filtering by chat.

**Result:** All chats received the same messages (from contact 905050969166@s.whatsapp.net)

**GitHub Issue:** https://github.com/EvolutionAPI/evolution-api/issues/1632

### 🐛 Problem 2: Contact Name Corruption
`processAndSaveMessage` was using `pushName` to update contact names on every message. In group chats, `pushName` is the LAST sender's name, causing "Musa Kerem Demirci" to overwrite many contacts.

### 🐛 Problem 3: No Sender Info in Group Messages
Group messages didn't show who sent each message - only the group name.

---

## Fixes Applied

### ✅ Fix 1: Client-Side Message Filtering (Commit: 214b9ce)
- `getChatMessages()` now fetches 10x more messages and filters client-side
- Properly sorts by timestamp and limits results
- **Temporary workaround** - Upgrade to Evolution API v2.3.7 recommended

### ✅ Fix 2: Stop Using pushName for Contacts (Commit: 9918b3e)
- Removed `ensure_contact_exists` call from message processing
- Contact names now only set during initial chat sync (from `chat.name`)
- `pushName` no longer overwrites contact names

### ✅ Fix 3: Add Sender Info to Group Messages (Commit: 9918b3e)
- Incoming group messages now show sender: `[Name (Phone)]: message`
- Example: `[Musa Kerem Demirci (905050969139)]: Hava soğuk`

---

## Deployment Steps

### 1️⃣ SSH to Server

```bash
ssh ubuntu@54.93.113.184
```

### 2️⃣ Pull Latest Code

```bash
cd /home/ubuntu/whatsapp-crm
git fetch origin claude/message-reconnect-gap-fill-z5U5W
git pull origin claude/message-reconnect-gap-fill-z5U5W
```

**Expected output:**
```
From http://...
   415471e..9918b3e  claude/message-reconnect-gap-fill-z5U5W -> origin/claude/message-reconnect-gap-fill-z5U5W
Updating 415471e..9918b3e
Fast-forward
 backend/src/config/evolution.js                | XX insertions(+), XX deletions(-)
 backend/src/services/syncService.evolution.js | XX insertions(+), XX deletions(-)
```

### 3️⃣ Restart Backend

```bash
cd backend
pm2 restart whatsapp-backend
pm2 logs whatsapp-backend --lines 30
```

**Check logs** - you should see the backend starting successfully.

### 4️⃣ Clean Corrupted Database (CRITICAL!)

**Go to Supabase Dashboard → SQL Editor**

**OPTION A: Delete ALL messages (recommended - cleanest)**
```sql
TRUNCATE TABLE messages CASCADE;
```

**OPTION B: Delete only recent messages (last 24 hours)**
```sql
DELETE FROM messages WHERE created_at > NOW() - INTERVAL '24 hours';
```

**OPTION C: Fix corrupted contact names**
```sql
-- Reset "Musa Kerem Demirci" names to NULL (will show phone number)
UPDATE contacts
SET name = NULL
WHERE name = 'Musa Kerem Demirci';
```

**Recommended: Run OPTION A + OPTION C** to fully clean corrupted data.

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
2. Are you running the latest commit (9918b3e)?
3. Check logs for "with client-side filter workaround" message
4. Did you clean the database (TRUNCATE messages)?

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
