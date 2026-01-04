/**
 * Professional Message Synchronization Service for Evolution API
 * Handles initial sync, gap-fill sync with rate limiting and spam prevention
 */

const { supabaseAdmin } = require('../config/database');
const { getChatMessages, getAllChats } = require('../config/evolution');
const { downloadAndUploadMedia } = require('./mediaService');

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
 * Automatically syncs ALL messages (including media) since last sync
 * Used when reconnecting after disconnection
 */
async function triggerGapFillSync(sessionId, onProgress = null) {
  try {
    console.log(`[Sync] 🔄 Starting GAP-FILL sync for session: ${sessionId}`);

    // Get session details
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('sessions')
      .select('id, session_name, status')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      throw new Error('Session not found');
    }

    if (session.status !== 'CONNECTED') {
      console.log(`[Sync] ⚠️ Session not connected, skipping sync`);
      return { success: false, reason: 'Session not connected' };
    }

    // Get last sync state
    const { data: syncState } = await supabaseAdmin
      .from('sync_state')
      .select('last_message_timestamp, last_synced_at')
      .eq('session_id', sessionId)
      .single();

    const lastSyncTimestamp = syncState?.last_message_timestamp || 0;
    console.log(`[Sync] Last synced timestamp: ${lastSyncTimestamp} (${new Date(lastSyncTimestamp * 1000).toISOString()})`);

    // Update sync state to 'syncing'
    await supabaseAdmin.rpc('update_sync_state', {
      p_session_id: sessionId,
      p_sync_status: 'syncing',
      p_sync_type: 'gap_fill'
    });

    // Get all chats from Evolution API
    const chatsResponse = await getAllChats(session.session_name);
    const allChats = chatsResponse || [];

    console.log(`[Sync] Found ${allChats.length} chats to check for new messages`);

    let totalSynced = 0;
    let totalChatsWithNewMessages = 0;

    // Process chats in batches (rate limiting)
    for (let i = 0; i < allChats.length; i += RATE_LIMIT.CHATS_PER_BATCH) {
      const chatBatch = allChats.slice(i, i + RATE_LIMIT.CHATS_PER_BATCH);

      for (const chat of chatBatch) {
        try {
          // Skip system chats
          if (!chat.id || chat.id === '0@s.whatsapp.net' || chat.id.startsWith('status@')) {
            continue;
          }

          const phoneNumber = chat.id.split('@')[0];
          const isGroup = chat.id.endsWith('@g.us');

          // Get messages from Evolution API (fetch more to ensure we get everything)
          const messagesResponse = await getChatMessages(
            session.session_name,
            chat.id,
            500 // Fetch up to 500 messages to catch everything missed
          );

          // Parse messages (handle all response formats)
          let messages = [];
          if (Array.isArray(messagesResponse)) {
            messages = messagesResponse;
          } else if (messagesResponse?.messages) {
            messages = Array.isArray(messagesResponse.messages)
              ? messagesResponse.messages
              : messagesResponse.messages.records || [];
          } else if (messagesResponse?.data) {
            messages = Array.isArray(messagesResponse.data)
              ? messagesResponse.data
              : messagesResponse.data.messages || [];
          }

          // Filter ONLY new messages (after last sync)
          const newMessages = lastSyncTimestamp > 0
            ? messages.filter(m => {
                const msgTimestamp = m.messageTimestamp || Math.floor(new Date(m.timestamp).getTime() / 1000);
                return msgTimestamp > lastSyncTimestamp;
              })
            : messages; // If no last sync, take all

          if (newMessages.length > 0) {
            console.log(`[Sync] 📥 Chat ${phoneNumber}: ${newMessages.length} new messages`);
            totalChatsWithNewMessages++;

            // Get or create contact
            const contactName = chat.name || chat.verifiedName || chat.notify || null;
            const { data: contactId } = await supabaseAdmin.rpc('ensure_contact_exists', {
              p_session_id: sessionId,
              p_phone_number: phoneNumber,
              p_name: contactName,
              p_is_group: isGroup
            });

            // Process each new message (including media download)
            for (const msg of newMessages) {
              try {
                await processAndSaveMessageWithMedia(sessionId, contactId, msg, phoneNumber, session.session_name);
                totalSynced++;
              } catch (msgError) {
                console.error(`[Sync] ❌ Error processing message:`, msgError);
              }
            }
          }

          // Progress callback
          if (onProgress) {
            onProgress({
              totalChats: allChats.length,
              processedChats: i + chatBatch.indexOf(chat) + 1,
              totalMessages: totalSynced,
              currentChat: phoneNumber,
              chatsWithNewMessages: totalChatsWithNewMessages
            });
          }

          // Rate limiting between chats
          await sleep(500);

        } catch (chatError) {
          console.error(`[Sync] ❌ Error syncing chat ${chat.id}:`, chatError);
        }
      }

      // Batch delay
      if (i + RATE_LIMIT.CHATS_PER_BATCH < allChats.length) {
        console.log(`[Sync] ⏸️ Batch completed. Waiting ${RATE_LIMIT.CHAT_DELAY_MS}ms...`);
        await sleep(RATE_LIMIT.CHAT_DELAY_MS);
      }
    }

    // Update sync state to completed
    await supabaseAdmin.rpc('update_sync_state', {
      p_session_id: sessionId,
      p_sync_status: 'completed',
      p_messages_count: totalSynced
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

    console.log(`[Sync] ✅ Gap-fill COMPLETED: ${totalSynced} messages from ${totalChatsWithNewMessages} chats`);

    return {
      success: true,
      totalMessages: totalSynced,
      totalChats: totalChatsWithNewMessages
    };

  } catch (error) {
    console.error('[Sync] ❌ Gap-fill sync error:', error);

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
 * Process and save message WITH media download
 * Used in gap-fill sync to ensure ALL media is downloaded
 */
async function processAndSaveMessageWithMedia(sessionId, contactId, messageData, contactPhone, instanceName) {
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

  // Extract message content and detect media
  let messageType = 'text';
  let messageBody = '';
  let hasMedia = false;
  let mediaData = null;

  if (msgContent.conversation) {
    messageBody = msgContent.conversation;
  } else if (msgContent.extendedTextMessage) {
    messageBody = msgContent.extendedTextMessage.text;
  } else if (msgContent.imageMessage) {
    messageBody = msgContent.imageMessage.caption || '';
    messageType = 'image';
    hasMedia = true;
    mediaData = msgContent.imageMessage;
  } else if (msgContent.videoMessage) {
    messageBody = msgContent.videoMessage.caption || '';
    messageType = 'video';
    hasMedia = true;
    mediaData = msgContent.videoMessage;
  } else if (msgContent.audioMessage) {
    messageType = 'audio';
    hasMedia = true;
    mediaData = msgContent.audioMessage;
  } else if (msgContent.documentMessage) {
    messageBody = msgContent.documentMessage.fileName || '';
    messageType = 'document';
    hasMedia = true;
    mediaData = msgContent.documentMessage;
  } else if (msgContent.stickerMessage) {
    messageType = 'sticker';
    hasMedia = true;
    mediaData = msgContent.stickerMessage;
  }

  // Download media if present
  let mediaUrl = null;
  let mediaFilename = null;
  let mediaMimetype = null;
  let mediaSize = null;

  if (hasMedia && mediaData) {
    console.log(`[Sync] 📥 Downloading ${messageType} for message ${messageId}...`);

    try {
      const uploadedMedia = await downloadAndUploadMedia(instanceName, key, mediaData, messageType);

      if (uploadedMedia) {
        mediaUrl = uploadedMedia.public_url;
        mediaFilename = uploadedMedia.filename;
        mediaMimetype = uploadedMedia.mimetype;
        mediaSize = uploadedMedia.size_bytes;
        console.log(`[Sync] ✅ Media downloaded: ${mediaFilename}`);
      }
    } catch (mediaError) {
      console.error(`[Sync] ⚠️ Media download failed (continuing anyway):`, mediaError);
      // Continue without media - don't block the entire message
    }
  }

  // Insert message
  const { data: insertedMessage, error: messageError } = await supabaseAdmin
    .from('messages')
    .insert({
      session_id: sessionId,
      contact_id: contactId,
      waha_message_id: messageId,
      message_type: messageType,
      body: messageBody,
      from_me: fromMe,
      ack: fromMe ? 'DEVICE' : 'READ', // Outgoing: DEVICE, Incoming: READ
      has_media: hasMedia,
      media_url: mediaUrl,
      media_filename: mediaFilename,
      media_mimetype: mediaMimetype,
      timestamp: new Date(messageTimestamp * 1000).toISOString(),
      raw_payload: messageData
    })
    .select()
    .single();

  if (messageError) {
    throw messageError;
  }

  // If media was downloaded, also save to message_media table
  if (hasMedia && mediaUrl) {
    await supabaseAdmin
      .from('message_media')
      .insert({
        message_id: insertedMessage.id,
        media_type: messageType,
        file_url: mediaUrl,
        file_name: mediaFilename,
        mime_type: mediaMimetype,
        file_size: mediaSize,
        download_status: 'completed'
      });
  }
}

/**
 * Process and save a single message (WITHOUT media download for speed)
 * Used in initial sync where we only need basic messages
 */
async function processAndSaveMessage(sessionId, contactId, messageData, isGroup = false) {
  const {
    key,
    message: msgContent,
    messageTimestamp,
    pushName
  } = messageData;

  const messageId = key.id;
  const fromMe = key.fromMe;

  // Extract participant info for group messages
  const participant = key.participant; // Phone number of sender in group chats
  const senderName = pushName; // Name of sender (for group messages)

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

  // For group messages (incoming only), prefix sender name
  if (isGroup && !fromMe && participant && senderName) {
    const senderPhone = participant.split('@')[0]; // Extract phone from "905050969139@s.whatsapp.net"
    const prefix = `${senderName} (${senderPhone})`;

    // Add prefix to text messages
    if (messageType === 'text' && messageBody) {
      messageBody = `[${prefix}]: ${messageBody}`;
    } else if (hasMedia) {
      // For media messages, add sender to caption
      messageBody = messageBody ? `[${prefix}]: ${messageBody}` : `[${prefix}]`;
    }
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
 * Initial message history sync - Syncs LAST N messages per chat
 * Use this when first connecting a session (lightweight, fast)
 *
 * @param {string} sessionId - UUID of the session
 * @param {number} messagesLimit - How many messages to fetch per chat (default: 10)
 * @param {Function} onProgress - Optional progress callback
 * @returns {Object} - Sync results
 */
async function initialMessageSync(sessionId, messagesLimit = 10, onProgress = null) {
  console.log(`[Sync] Starting INITIAL sync for session: ${sessionId} (limit: ${messagesLimit} messages/chat)`);

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
          // IMPORTANT: Don't use pushName - it changes based on last message sender!
          // Only use reliable sources: chat.name (WhatsApp saved name) or verifiedName
          let contactName = chat.name ||
                           chat.verifiedName ||
                           chat.notify ||
                           null; // Don't fallback to phone number or pushName, let DB handle it

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

          // Fetch ONLY LAST N messages for this chat (fast initial sync)
          console.log(`[Sync] Fetching last ${messagesLimit} messages for: ${phoneNumber}`);

          const messagesResponse = await getChatMessages(
            session.session_name,
            chat.id,
            messagesLimit // Use parameter instead of hardcoded limit
          );

          // Debug: Log the raw response structure
          console.log(`[Sync] ===== API Response Debug for ${phoneNumber} =====`);
          console.log(`[Sync] Response type:`, typeof messagesResponse);
          console.log(`[Sync] Is Array:`, Array.isArray(messagesResponse));
          console.log(`[Sync] Response keys:`, messagesResponse ? Object.keys(messagesResponse) : 'null');
          console.log(`[Sync] Full response (first 1000 chars):`, JSON.stringify(messagesResponse).substring(0, 1000));

          // Handle ALL possible Evolution API response formats
          let messages = [];

          if (Array.isArray(messagesResponse)) {
            // Direct array response: [{message1}, {message2}, ...]
            messages = messagesResponse;
            console.log(`[Sync] Format: Direct array`);
          } else if (messagesResponse && messagesResponse.messages) {
            // Wrapped in .messages: { messages: [...] }
            if (Array.isArray(messagesResponse.messages)) {
              messages = messagesResponse.messages;
              console.log(`[Sync] Format: Wrapped in 'messages' array`);
            } else if (Array.isArray(messagesResponse.messages.records)) {
              // Double nested: { messages: { records: [...] } }
              messages = messagesResponse.messages.records;
              console.log(`[Sync] Format: messages.records`);
            }
          } else if (messagesResponse && Array.isArray(messagesResponse.data)) {
            // Wrapped in .data: { data: [...] }
            messages = messagesResponse.data;
            console.log(`[Sync] Format: Wrapped in 'data' array`);
          } else if (messagesResponse && messagesResponse.data && Array.isArray(messagesResponse.data.messages)) {
            // Double nested: { data: { messages: [...] } }
            messages = messagesResponse.data.messages;
            console.log(`[Sync] Format: data.messages`);
          } else if (messagesResponse) {
            // Try to find any array property in the response
            console.log(`[Sync] WARNING: Unknown response format, searching for array...`);
            for (const key of Object.keys(messagesResponse)) {
              if (Array.isArray(messagesResponse[key])) {
                messages = messagesResponse[key];
                console.log(`[Sync] Format: Found array in '${key}' property`);
                break;
              }
            }
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
                  await processAndSaveMessage(sessionId, contactId, msg, isGroup);
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
