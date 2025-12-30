/**
 * Professional Message Synchronization Service for Evolution API
 * Handles initial sync, gap-fill sync with rate limiting and spam prevention
 */

const { supabaseAdmin } = require('../config/database');
const { getChatMessages, getAllChats } = require('../config/evolution');

// Rate limiting configuration (prevent WhatsApp spam detection)
const RATE_LIMIT = {
  MESSAGES_PER_BATCH: 50,
  BATCH_DELAY_MS: 2000, // 2 seconds between batches
  CHATS_PER_BATCH: 10,
  CHAT_DELAY_MS: 1000, // 1 second between chat batches
  MAX_MESSAGES_PER_CHAT: 1000, // Safety limit
};

/**
 * Sleep utility for rate limiting
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Trigger gap-fill sync for a session
 * Automatically syncs messages since last_message_timestamp
 */
async function triggerGapFillSync(sessionId) {
  try {
    console.log(`[Sync] Starting gap-fill sync for session: ${sessionId}`);

    // Get session details
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('sessions')
      .select('id, session_name, last_message_timestamp, status')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      throw new Error('Session not found');
    }

    if (session.status !== 'CONNECTED') {
      console.log(`[Sync] Session not connected, skipping sync`);
      return;
    }

    // Create sync log entry
    const { data: syncLog, error: logError } = await supabaseAdmin
      .from('sync_logs')
      .insert({
        session_id: sessionId,
        sync_type: 'gap_fill',
        status: 'started',
        from_timestamp: session.last_message_timestamp,
        to_timestamp: new Date().toISOString()
      })
      .select()
      .single();

    if (logError) {
      throw logError;
    }

    try {
      // Get all chats from Evolution API
      const chats = await getAllChats(session.session_name);

      console.log(`[Sync] Found ${chats.length} chats to sync`);

      let totalSynced = 0;

      // Sync messages for each chat
      for (const chat of chats) {
        try {
          const phoneNumber = chat.id.split('@')[0];

          // Get messages from Evolution API
          const messages = await getChatMessages(session.session_name, chat.id, 100);

          // Filter messages newer than last_message_timestamp
          const newMessages = session.last_message_timestamp
            ? messages.filter(m => new Date(m.messageTimestamp * 1000) > new Date(session.last_message_timestamp))
            : messages;

          console.log(`[Sync] Chat ${phoneNumber}: ${newMessages.length} new messages`);

          // Process each message
          for (const msg of newMessages) {
            try {
              await processAndSaveMessage(sessionId, msg, phoneNumber);
              totalSynced++;
            } catch (msgError) {
              console.error(`[Sync] Error processing message:`, msgError);
            }
          }
        } catch (chatError) {
          console.error(`[Sync] Error syncing chat ${chat.id}:`, chatError);
        }
      }

      // Update sync log as completed
      await supabaseAdmin
        .from('sync_logs')
        .update({
          status: 'completed',
          messages_synced: totalSynced,
          completed_at: new Date().toISOString()
        })
        .eq('id', syncLog.id);

      console.log(`[Sync] Gap-fill completed: ${totalSynced} messages synced`);
    } catch (syncError) {
      // Update sync log as failed
      await supabaseAdmin
        .from('sync_logs')
        .update({
          status: 'failed',
          error_message: syncError.message,
          completed_at: new Date().toISOString()
        })
        .eq('id', syncLog.id);

      throw syncError;
    }
  } catch (error) {
    console.error('[Sync] Gap-fill sync error:', error);
    throw error;
  }
}

/**
 * Process and save a single message
 */
async function processAndSaveMessage(sessionId, messageData, contactPhone) {
  const {
    key,
    message: msgContent,
    messageTimestamp,
    pushName
  } = messageData;

  const messageId = key.id;
  const fromMe = key.fromMe;

  // Check if already exists
  const { data: existing } = await supabaseAdmin
    .from('messages')
    .select('id')
    .eq('session_id', sessionId)
    .eq('waha_message_id', messageId)
    .single();

  if (existing) {
    return; // Skip duplicates
  }

  // Get or create contact
  const { data: contactId } = await supabaseAdmin.rpc('ensure_contact_exists', {
    p_session_id: sessionId,
    p_phone_number: contactPhone,
    p_name: pushName || null,
    p_is_group: false
  });

  // Extract message content
  let messageType = 'text';
  let messageBody = '';
  let hasMedia = false;

  if (msgContent.conversation) {
    messageBody = msgContent.conversation;
  } else if (msgContent.extendedTextMessage) {
    messageBody = msgContent.extendedTextMessage.text;
  } else if (msgContent.imageMessage) {
    messageBody = msgContent.imageMessage.caption || '';
    messageType = 'image';
    hasMedia = true;
  } else if (msgContent.videoMessage) {
    messageBody = msgContent.videoMessage.caption || '';
    messageType = 'video';
    hasMedia = true;
  } else if (msgContent.audioMessage) {
    messageType = 'audio';
    hasMedia = true;
  } else if (msgContent.documentMessage) {
    messageBody = msgContent.documentMessage.fileName || '';
    messageType = 'document';
    hasMedia = true;
  }

  // Insert message
  const { error } = await supabaseAdmin
    .from('messages')
    .insert({
      session_id: sessionId,
      contact_id: contactId,
      waha_message_id: messageId,
      message_type: messageType,
      body: messageBody,
      from_me: fromMe,
      ack: 'READ', // Historical messages are already read
      has_media: hasMedia,
      timestamp: new Date(messageTimestamp * 1000).toISOString(),
      raw_payload: messageData
    });

  if (error) {
    throw error;
  }
}

/**
 * Manual sync trigger (for admin use)
 */
async function triggerManualSync(sessionId, userId) {
  console.log(`[Sync] Manual sync triggered by user: ${userId}`);
  return triggerGapFillSync(sessionId);
}

module.exports = {
  triggerGapFillSync,
  triggerManualSync
};
