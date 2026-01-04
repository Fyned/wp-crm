-- Clean up corrupted messages AND contacts from pushName bug
--
-- BUG 1: Evolution API v1.8.4 - /chat/findMessages ignores remoteJid filter
--        Result: All chats got same messages (wrong data)
--
-- BUG 2: pushName was used to update contact names on every message
--        Result: Contact names corrupted (especially from group chats)
--        Example: "Musa Kerem Demirci" (last group message sender) overwrote many contacts
--
-- SOLUTION: Delete messages + reset contact names, then re-sync with fixed code

-- STEP 1: Delete all messages (required - they have wrong chat assignments)
TRUNCATE TABLE messages CASCADE;

-- STEP 2: Reset contact names to NULL (let re-sync populate from chat.name)
-- This is SAFE because:
-- - Re-sync will populate names from WhatsApp chat.name (reliable source)
-- - If no chat.name exists, frontend shows phone number
-- - Real "Musa Kerem Demirci" will get correct name from his own chat.name
UPDATE contacts SET name = NULL;

-- Show what was done
DO $$
BEGIN
  RAISE NOTICE 'Cleanup complete! All messages deleted and contact names reset.';
  RAISE NOTICE 'Next step: Run Initial Sync from frontend to repopulate with correct data.';
END $$;
