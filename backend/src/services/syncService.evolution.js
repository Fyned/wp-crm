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
 * Initial message history sync - Syncs ALL chats and messages
 * Use this when first connecting a session
 *
 * @param {string} sessionId - UUID of the session
 * @param {Function} onProgress - Optional progress callback
 * @returns {Object} - Sync results
 */
async function initialMessageSync(sessionId, onProgress = null) {
  console.log(`[Sync] Starting INITIAL sync for session: ${sessionId}`);

  try {
    // Get session details
    const { data: session } = await supabaseAdmin
      .from('sessions')
      .select('id, session_name, status')
      .eq('id', sessionId)
      .single();

    if (!session || session.status !== 'CONNECTED') {
      throw new Error('Session must be CONNECTED to sync');
    }

    // Update sync state
    await supabaseAdmin.rpc('update_sync_state', {
      p_session_id: sessionId,
      p_sync_status: 'syncing',
      p_sync_type: 'initial'
    });

    // Fetch ALL chats from Evolution API
    console.log('[Sync] Fetching all chats from Evolution API...');
    const chatsResponse = await getAllChats(session.session_name);
    const allChats = chatsResponse || [];

    console.log(`[Sync] Found ${allChats.length} chats to sync`);

    let totalMessagesSynced = 0;
    let totalChatsProcessed = 0;

    // Process chats in batches (rate limiting)
    for (let i = 0; i < allChats.length; i += RATE_LIMIT.CHATS_PER_BATCH) {
      const chatBatch = allChats.slice(i, i + RATE_LIMIT.CHATS_PER_BATCH);

      for (const chat of chatBatch) {
        try {
          // Skip invalid/system chats ONLY
          if (!chat.id || chat.id === '0@s.whatsapp.net' || chat.id.startsWith('status@') || chat.id === 'status@broadcast') {
            console.log(`[Sync] Skipping system chat: ${chat.id}`);
            continue;
          }

          const phoneNumber = chat.id.split('@')[0];
          const isGroup = chat.id.endsWith('@g.us');
          const isLid = chat.id.endsWith('@lid'); // Business/Newsletter accounts (INCLUDE these!)

          // Validate phone number format (but allow @lid contacts even if they look weird)
          if (!isLid && !isGroup && !/^\d{7,15}$/.test(phoneNumber)) {
            console.log(`[Sync] Skipping invalid phone number: ${phoneNumber} from ${chat.id}`);
            continue;
          }

          // Extract contact name with multiple fallbacks
          let contactName = chat.name ||
                           chat.pushName ||
                           chat.notify ||
                           chat.verifiedName ||
                           null; // Don't fallback to phone number, let DB handle it

          // Debug: Log chat object to see what fields are available
          console.log(`[Sync] Processing chat:`, {
            id: chat.id,
            phoneNumber,
            extractedName: contactName,
            isGroup
          });

          // Get or create contact
          const { data: contactId } = await supabaseAdmin.rpc('ensure_contact_exists', {
            p_session_id: sessionId,
            p_phone_number: phoneNumber,
            p_name: contactName,
            p_is_group: isGroup
          });

          // Update contact metadata
          await supabaseAdmin
            .from('contacts')
            .update({
              whatsapp_metadata: {
                unreadCount: chat.unreadCount || 0,
                conversationTimestamp: chat.conversationTimestamp,
                archived: chat.archived || false,
                pinned: chat.pinned || false
              }
            })
            .eq('id', contactId);

          // Fetch messages for this chat
          console.log(`[Sync] Fetching messages for: ${phoneNumber}`);

          const messagesResponse = await getChatMessages(
            session.session_name,
            chat.id,
            RATE_LIMIT.MAX_MESSAGES_PER_CHAT
          );

          // Debug: Log the raw response
          console.log(`[Sync] API Response type:`, typeof messagesResponse);
          console.log(`[Sync] API Response:`, JSON.stringify(messagesResponse).substring(0, 500));

          // Handle different response formats from Evolution API
          let messages = [];
          if (Array.isArray(messagesResponse)) {
            messages = messagesResponse;
          } else if (messagesResponse && Array.isArray(messagesResponse.messages)) {
            messages = messagesResponse.messages;
          } else if (messagesResponse && Array.isArray(messagesResponse.data)) {
            messages = messagesResponse.data;
          }

          console.log(`[Sync] Extracted ${messages.length} messages for ${phoneNumber}`);

          // If contact has no name, try to extract from messages
          if (!contactName && messages && messages.length > 0) {
            for (const msg of messages) {
              if (msg.pushName && msg.pushName !== phoneNumber) {
                contactName = msg.pushName;
                console.log(`[Sync] Extracted name from message: ${contactName}`);

                // Update contact with extracted name
                await supabaseAdmin
                  .from('contacts')
                  .update({ name: contactName })
                  .eq('id', contactId);
                break;
              }
            }
          }

          if (messages && messages.length > 0) {
            console.log(`[Sync] Found ${messages.length} messages for ${phoneNumber}`);

            // Save messages in batches
            for (let j = 0; j < messages.length; j += RATE_LIMIT.MESSAGES_PER_BATCH) {
              const msgBatch = messages.slice(j, j + RATE_LIMIT.MESSAGES_PER_BATCH);

              for (const msg of msgBatch) {
                try {
                  await processAndSaveMessage(sessionId, msg, phoneNumber);
                  totalMessagesSynced++;
                } catch (msgError) {
                  console.error('[Sync] Error saving message:', msgError);
                }
              }

              // Batch delay
              if (j + RATE_LIMIT.MESSAGES_PER_BATCH < messages.length) {
                await sleep(RATE_LIMIT.BATCH_DELAY_MS);
              }
            }
          }

          totalChatsProcessed++;

          // Progress callback
          if (onProgress) {
            onProgress({
              totalChats: allChats.length,
              processedChats: totalChatsProcessed,
              totalMessages: totalMessagesSynced,
              currentChat: phoneNumber
            });
          }

          // Rate limiting between chats
          await sleep(500);

        } catch (chatError) {
          console.error(`[Sync] Error processing chat ${chat.id}:`, chatError);
          // Continue with next chat
        }
      }

      // Batch delay
      if (i + RATE_LIMIT.CHATS_PER_BATCH < allChats.length) {
        console.log(`[Sync] Batch completed. Waiting ${RATE_LIMIT.CHAT_DELAY_MS}ms...`);
        await sleep(RATE_LIMIT.CHAT_DELAY_MS);
      }
    }

    // Update sync state to completed
    await supabaseAdmin.rpc('update_sync_state', {
      p_session_id: sessionId,
      p_sync_status: 'completed',
      p_messages_count: totalMessagesSynced
    });

    // Update last_message_timestamp
    const { data: lastMessage } = await supabaseAdmin
      .from('messages')
      .select('timestamp')
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    if (lastMessage) {
      await supabaseAdmin
        .from('sync_state')
        .update({
          last_message_timestamp: Math.floor(new Date(lastMessage.timestamp).getTime() / 1000)
        })
        .eq('session_id', sessionId);
    }

    console.log(`[Sync] Initial sync COMPLETED: ${totalMessagesSynced} messages from ${totalChatsProcessed} chats`);

    return {
      success: true,
      totalChats: totalChatsProcessed,
      totalMessages: totalMessagesSynced
    };

  } catch (error) {
    console.error('[Sync] Initial sync error:', error);

    // Update sync state to failed
    await supabaseAdmin
      .from('sync_state')
      .update({
        sync_status: 'failed',
        error_message: error.message
      })
      .eq('session_id', sessionId);

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
  triggerManualSync,
  initialMessageSync
};
