# Database Migration Instructions

## How to Apply Migrations to Supabase

### Method 1: Supabase Dashboard (Recommended)

1. Go to your Supabase project: https://supabase.com/dashboard/project/jillpsifuqdioispmlaq

2. Click on **SQL Editor** in the left sidebar

3. Click **New Query**

4. Copy the entire content of `migrations/003_crm_features.sql`

5. Paste into the SQL editor

6. Click **Run** (or press Ctrl+Enter)

7. Verify success: You should see "Success. No rows returned"

### Method 2: Supabase CLI (Advanced)

```bash
# Install Supabase CLI (if not installed)
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref jillpsifuqdioispmlaq

# Apply migration
supabase db push
```

## Verify Migration Success

Run this query in SQL Editor to check if tables were created:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'session_metadata',
  'contact_metadata',
  'chat_assignments',
  'message_media',
  'sync_state',
  'chat_groups',
  'chat_group_members'
)
ORDER BY table_name;
```

Expected output: 7 tables

## Test RPC Functions

```sql
-- Test upsert_session_metadata
SELECT upsert_session_metadata(
  (SELECT id FROM sessions LIMIT 1),
  'My Custom Session Name',
  'Sample notes for testing',
  ARRAY['customer', 'vip'],
  '#10B981',
  TRUE
);

-- Verify it was created
SELECT * FROM session_metadata;
```

## Rollback (if needed)

If something goes wrong, run this to drop all new tables:

```sql
DROP TABLE IF EXISTS chat_group_members CASCADE;
DROP TABLE IF EXISTS chat_groups CASCADE;
DROP TABLE IF EXISTS sync_state CASCADE;
DROP TABLE IF EXISTS message_media CASCADE;
DROP TABLE IF EXISTS chat_assignments CASCADE;
DROP TABLE IF EXISTS contact_metadata CASCADE;
DROP TABLE IF EXISTS session_metadata CASCADE;
```

## Next Steps

After migration is successful:
1. ✅ Tables created
2. ✅ Indexes created
3. ✅ RPC functions created
4. ✅ Triggers created

You can now:
- Start backend services
- Use CRM features (notes, labels, assignments)
- Sync message history
- Store media files
