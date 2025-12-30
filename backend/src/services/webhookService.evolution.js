/**
 * Webhook Service for Evolution API
 * Handles incoming webhooks from Evolution API
 */

const { supabaseAdmin } = require('../config/database');
const { downloadAndUploadMedia } = require('./mediaService');

/**
 * Handle incoming message webhook (MESSAGES_UPSERT)
 */
async function handleIncomingMessage(instance, messageData) {
  try {
    const message = messageData.data;

    // Extract message details
    const {
      key,
      message: msgContent,
      messageTimestamp,
      pushName,
      status
    } = message;

    const messageId = key.id;
    const fromMe = key.fromMe;
    const remoteJid = key.remoteJid;

    // Get session from database
    const { data: session } = await supabaseAdmin
      .from('sessions')
      .select('id, session_name')
      .eq('session_name', instance)
      .single();

    if (!session) {
      console.error(`[Webhook] Session not found: ${instance}`);
      return;
    }

    // Determine contact phone number
    const contactPhone = remoteJid.split('@')[0];

    // Ensure contact exists
    // IMPORTANT: Only update name from incoming messages (not from us)
    // to prevent overwriting contact names with our line's name
    const { data: contactId } = await supabaseAdmin.rpc('ensure_contact_exists', {
      p_session_id: session.id,
      p_phone_number: contactPhone,
      p_name: fromMe ? null : (pushName || null), // Don't update name if message is from us
      p_is_group: remoteJid.endsWith('@g.us')
    });

    // Check if message already exists (idempotency)
    const { data: existing } = await supabaseAdmin
      .from('messages')
      .select('id')
      .eq('session_id', session.id)
      .eq('waha_message_id', messageId)
      .single();

    if (existing) {
      console.log(`[Webhook] Message already exists: ${messageId}`);
      return;
    }

    // Extract message type and body
    let messageType = 'text';
    let messageBody = '';
    let hasMedia = false;
    let mediaUrl = null;
    let mediaData = null;

    if (msgContent.conversation) {
      messageBody = msgContent.conversation;
      messageType = 'text';
    } else if (msgContent.extendedTextMessage) {
      messageBody = msgContent.extendedTextMessage.text;
      messageType = 'text';
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
    } else if (msgContent.locationMessage) {
      messageType = 'location';
      messageBody = JSON.stringify({
        latitude: msgContent.locationMessage.degreesLatitude,
        longitude: msgContent.locationMessage.degreesLongitude
      });
    } else if (msgContent.contactMessage) {
      messageType = 'contact';
      messageBody = msgContent.contactMessage.displayName || '';
    }

    // Prepare message record
    const messageRecord = {
      session_id: session.id,
      contact_id: contactId,
      waha_message_id: messageId,
      message_type: messageType,
      body: messageBody,
      from_me: fromMe,
      ack: mapAckStatus(status),
      has_media: hasMedia,
      timestamp: new Date(messageTimestamp * 1000).toISOString(),
      raw_payload: message
    };

    // Insert message
    const { data: insertedMessage, error: insertError } = await supabaseAdmin
      .from('messages')
      .insert(messageRecord)
      .select()
      .single();

    if (insertError) {
      console.error('[Webhook] Message insert error:', insertError);
      throw insertError;
    }

    console.log(`[Webhook] Message saved: ${messageId}`);

    // Handle media if present (Images, Videos, Audio, Documents, etc.)
    if (hasMedia && mediaData) {
      try {
        console.log(`[Webhook] 📎 Processing ${messageType} media for message: ${messageId}`);

        // Download and upload media to Supabase Storage
        const mediaInfo = await downloadAndUploadMedia(
          instance,
          key,
          mediaData,
          messageType
        );

        if (mediaInfo) {
          // Update message with media information
          await supabaseAdmin
            .from('messages')
            .update({
              media_url: mediaInfo.public_url,
              media_mimetype: mediaInfo.mimetype,
              media_size: mediaInfo.size_bytes,
              media_filename: mediaInfo.filename
            })
            .eq('id', insertedMessage.id);

          // Create message_media record
          await supabaseAdmin
            .from('message_media')
            .insert({
              message_id: insertedMessage.id,
              media_type: mediaInfo.media_type,
              file_url: mediaInfo.public_url,
              file_name: mediaInfo.filename,
              file_size: mediaInfo.size_bytes,
              mime_type: mediaInfo.mimetype
            });

          console.log(`[Webhook] ✅ Media processed successfully: ${mediaInfo.filename}`);
        }
      } catch (mediaError) {
        console.error('[Webhook] ❌ Media processing error:', mediaError);
        // Continue even if media fails - message is still saved
      }
    }
  } catch (error) {
    console.error('[Webhook] handleIncomingMessage error:', error);
    throw error;
  }
}

/**
 * Handle message acknowledgment update (MESSAGES_UPDATE)
 */
async function handleMessageAck(instance, ackData) {
  try {
    const { key, update } = ackData.data;
    const messageId = key.id;
    const status = update.status;

    // Get session
    const { data: session } = await supabaseAdmin
      .from('sessions')
      .select('id')
      .eq('session_name', instance)
      .single();

    if (!session) {
      console.error(`[Webhook] Session not found: ${instance}`);
      return;
    }

    // Update message ack status
    const { error } = await supabaseAdmin
      .from('messages')
      .update({ ack: mapAckStatus(status) })
      .eq('session_id', session.id)
      .eq('waha_message_id', messageId);

    if (error) {
      console.error('[Webhook] ACK update error:', error);
      throw error;
    }

    console.log(`[Webhook] Message ACK updated: ${messageId} -> ${status}`);
  } catch (error) {
    console.error('[Webhook] handleMessageAck error:', error);
    throw error;
  }
}

/**
 * Handle connection status update (CONNECTION_UPDATE)
 */
async function handleConnectionUpdate(instance, connectionData) {
  try {
    const { state, statusReason } = connectionData;

    console.log(`[Webhook] Connection update: ${instance} -> ${state}`);

    // Map Evolution API status to our status
    let dbStatus = 'DISCONNECTED';
    if (state === 'open') {
      dbStatus = 'CONNECTED';
    } else if (state === 'connecting') {
      dbStatus = 'CONNECTING';
    } else if (state === 'close') {
      dbStatus = 'DISCONNECTED';
    }

    // Update session status in database
    const updateData = {
      status: dbStatus,
      waha_metadata: {
        evolution_state: state,
        status_reason: statusReason,
        last_update: new Date().toISOString()
      }
    };

    if (dbStatus === 'CONNECTED') {
      updateData.last_connected_at = new Date().toISOString();
    }

    const { error } = await supabaseAdmin
      .from('sessions')
      .update(updateData)
      .eq('session_name', instance);

    if (error) {
      throw error;
    }

    // If just connected, trigger gap-fill sync
    if (dbStatus === 'CONNECTED') {
      const { data: session } = await supabaseAdmin
        .from('sessions')
        .select('id')
        .eq('session_name', instance)
        .single();

      if (session) {
        console.log(`[Webhook] Session connected - triggering gap-fill sync`);
        // Import and trigger sync (don't await to avoid blocking webhook)
        const { triggerGapFillSync } = require('./syncService.evolution');
        triggerGapFillSync(session.id).catch(err => {
          console.error('[Webhook] Gap-fill sync error:', err);
        });
      }
    }
  } catch (error) {
    console.error('[Webhook] handleConnectionUpdate error:', error);
    throw error;
  }
}

/**
 * Handle QR code update (QRCODE_UPDATED)
 */
async function handleQRCodeUpdate(instance, qrData) {
  try {
    const { qrcode } = qrData;

    console.log(`[Webhook] QR Code updated for instance: ${instance}`);

    // Store QR code in session metadata (optional)
    const { error } = await supabaseAdmin
      .from('sessions')
      .update({
        waha_metadata: {
          qr_code_updated_at: new Date().toISOString(),
          has_qr: true
        }
      })
      .eq('session_name', instance);

    if (error) {
      console.error('[Webhook] QR code update error:', error);
    }
  } catch (error) {
    console.error('[Webhook] handleQRCodeUpdate error:', error);
  }
}

/**
 * Handle contacts update (CONTACTS_UPSERT)
 */
async function handleContactsUpdate(instance, contactsData) {
  try {
    const contacts = contactsData.data;

    // Get session
    const { data: session } = await supabaseAdmin
      .from('sessions')
      .select('id')
      .eq('session_name', instance)
      .single();

    if (!session) {
      return;
    }

    // Update contacts in database
    for (const contact of contacts) {
      const phoneNumber = contact.id.split('@')[0];
      const name = contact.name || contact.notify || contact.verifiedName;

      await supabaseAdmin.rpc('ensure_contact_exists', {
        p_session_id: session.id,
        p_phone_number: phoneNumber,
        p_name: name,
        p_is_group: contact.id.endsWith('@g.us')
      });
    }

    console.log(`[Webhook] Updated ${contacts.length} contacts for ${instance}`);
  } catch (error) {
    console.error('[Webhook] handleContactsUpdate error:', error);
  }
}

/**
 * Handle chats update (CHATS_UPSERT)
 */
async function handleChatsUpdate(instance, chatsData) {
  try {
    const chats = chatsData.data;

    // Get session
    const { data: session } = await supabaseAdmin
      .from('sessions')
      .select('id')
      .eq('session_name', instance)
      .single();

    if (!session) {
      return;
    }

    // Update chats metadata
    for (const chat of chats) {
      const phoneNumber = chat.id.split('@')[0];

      await supabaseAdmin
        .from('contacts')
        .update({
          whatsapp_metadata: {
            unreadCount: chat.unreadCount,
            conversationTimestamp: chat.conversationTimestamp,
            archived: chat.archived,
            pinned: chat.pinned
          }
        })
        .eq('session_id', session.id)
        .eq('phone_number', phoneNumber);
    }

    console.log(`[Webhook] Updated ${chats.length} chats for ${instance}`);
  } catch (error) {
    console.error('[Webhook] handleChatsUpdate error:', error);
  }
}

/**
 * Map Evolution API status to our ACK enum
 */
function mapAckStatus(status) {
  const statusMap = {
    0: 'PENDING',
    1: 'SERVER',
    2: 'DEVICE',
    3: 'READ',
    4: 'PLAYED'
  };

  return statusMap[status] || 'PENDING';
}

module.exports = {
  handleIncomingMessage,
  handleMessageAck,
  handleConnectionUpdate,
  handleQRCodeUpdate,
  handleContactsUpdate,
  handleChatsUpdate
};
