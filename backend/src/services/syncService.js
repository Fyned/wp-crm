/**
 * Smart Sync Service
 * Handles automatic gap-filling and message synchronization
 */

const { supabaseAdmin } = require('../config/database');
const wahaClient = require('../config/waha');
const { downloadAndUploadMedia } = require('./mediaService');

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
      // Fetch messages from WAHA
      const messages = await fetchMessagesFromWaha(
        session.session_name,
        session.last_message_timestamp
      );

      console.log(`[Sync] Fetched ${messages.length} messages from WAHA`);

      let syncedCount = 0;

      // Process each message
      for (const msg of messages) {
        try {
          await processAndSaveMessage(sessionId, msg);
          syncedCount++;
        } catch (msgError) {
          console.error(`[Sync] Error processing message ${msg.id}:`, msgError);
          // Continue with next message
        }
      }

      // Update sync log as completed
      await supabaseAdmin
        .from('sync_logs')
        .update({
          status: 'completed',
          messages_synced: syncedCount,
          completed_at: new Date().toISOString()
        })
        .eq('id', syncLog.id);

      console.log(`[Sync] Gap-fill completed: ${syncedCount} messages synced`);
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
 * Fetch messages from WAHA API
 */
async function fetchMessagesFromWaha(sessionName, fromTimestamp = null) {
  try {
    const params = {
      limit: 1000 // Max messages per request
    };

    // If we have a last timestamp, only fetch newer messages
    if (fromTimestamp) {
      const timestamp = Math.floor(new Date(fromTimestamp).getTime() / 1000);
      params.timestamp = timestamp;
    }

    const response = await wahaClient.get(`/api/messages/${sessionName}`, {
      params
    });

    return response.data || [];
  } catch (error) {
    console.error('[Sync] WAHA fetch error:', error);

    // If endpoint not supported, try alternative approach
    if (error.response?.status === 404) {
      console.log('[Sync] Messages endpoint not available, using chats approach');
      return await fetchMessagesFromChats(sessionName, fromTimestamp);
    }

    throw error;
  }
}

/**
 * Alternative: Fetch messages from chats
 */
async function fetchMessagesFromChats(sessionName, fromTimestamp = null) {
  try {
    // Get all chats
    const chatsResponse = await wahaClient.get(`/api/chats/${sessionName}`);
    const chats = chatsResponse.data || [];

    const allMessages = [];

    // Fetch messages for each chat
    for (const chat of chats) {
      try {
        const messagesResponse = await wahaClient.get(
          `/api/chats/${sessionName}/${chat.id}/messages`,
          {
            params: { limit: 1000 }
          }
        );

        const messages = messagesResponse.data || [];

        // Filter by timestamp if provided
        if (fromTimestamp) {
          const timestampSeconds = Math.floor(new Date(fromTimestamp).getTime() / 1000);
          allMessages.push(...messages.filter(m => m.timestamp > timestampSeconds));
        } else {
          allMessages.push(...messages);
        }
      } catch (chatError) {
        console.error(`[Sync] Error fetching messages for chat ${chat.id}:`, chatError);
      }
    }

    return allMessages;
  } catch (error) {
    console.error('[Sync] fetchMessagesFromChats error:', error);
    return [];
  }
}

/**
 * Process and save a single message
 */
async function processAndSaveMessage(sessionId, messageData) {
  const {
    id: wahaMessageId,
    from,
    to,
    body,
    type,
    timestamp,
    fromMe,
    hasMedia,
    mediaUrl,
    ack
  } = messageData;

  // Check if already exists
  const { data: existing } = await supabaseAdmin
    .from('messages')
    .select('id')
    .eq('session_id', sessionId)
    .eq('waha_message_id', wahaMessageId)
    .single();

  if (existing) {
    return; // Skip duplicates
  }

  // Get or create contact
  const contactPhone = fromMe ? to : from;
  const { data: contactId } = await supabaseAdmin.rpc('ensure_contact_exists', {
    p_session_id: sessionId,
    p_phone_number: contactPhone,
    p_name: messageData.notifyName || null,
    p_is_group: messageData.isGroup || false
  });

  // Insert message
  const { data: insertedMessage, error } = await supabaseAdmin
    .from('messages')
    .insert({
      session_id: sessionId,
      contact_id: contactId,
      waha_message_id: wahaMessageId,
      message_type: type || 'text',
      body: body || '',
      from_me: fromMe,
      ack: ack || 'PENDING',
      has_media: hasMedia || false,
      timestamp: new Date(timestamp * 1000).toISOString(),
      raw_payload: messageData
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  // Handle media
  if (hasMedia && mediaUrl) {
    try {
      await downloadAndUploadMedia(insertedMessage.id, mediaUrl, messageData);
    } catch (mediaError) {
      console.error('[Sync] Media error:', mediaError);
      // Continue even if media fails
    }
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
  triggerManualSync,
  processAndSaveMessage
};
