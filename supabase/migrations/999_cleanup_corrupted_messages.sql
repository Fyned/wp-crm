-- Clean up corrupted messages from Evolution API v1.8.4 bug
-- The bug: /chat/findMessages ignores remoteJid filter and returns ALL messages
-- Result: Messages from sync were saved with wrong contact_id
-- Solution: Delete ALL messages and re-sync with fixed code

-- OPTION 1: Delete all messages (safest - start fresh)
-- Uncomment this to delete everything:
-- TRUNCATE TABLE messages CASCADE;

-- OPTION 2: Delete only messages from specific session (safer if multiple sessions)
-- Replace SESSION_ID_HERE with actual UUID
-- DELETE FROM messages WHERE session_id = 'SESSION_ID_HERE';

-- OPTION 3: Delete messages created recently (from corrupted sync)
-- This deletes messages created in last 24 hours
DELETE FROM messages WHERE created_at > NOW() - INTERVAL '24 hours';

-- Show what was deleted
DO $$
DECLARE
  deleted_count INTEGER;
BEGIN
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % messages from recent corrupted sync', deleted_count;
END $$;
