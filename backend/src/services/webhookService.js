/**
 * Webhook Service
 * Business logic for processing WAHA webhooks
 */

const { supabaseAdmin } = require('../config/database');
const { downloadAndUploadMedia } = require('./mediaService');
const { triggerGapFillSync } = require('./syncService');

/**
 * Handle incoming message webhook
 */
async function handleIncomingMessage(sessionId, messageData) {
  try {
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

    // Determine contact phone number
    const contactPhone = fromMe ? to : from;

    // Ensure contact exists in database
    const { data: contact } = await supabaseAdmin.rpc('ensure_contact_exists', {
      p_session_id: sessionId,
      p_phone_number: contactPhone,
      p_name: messageData.notifyName || null,
      p_is_group: false
    });

    const contactId = contact;

    // Check if message already exists (idempotency)
    const { data: existing } = await supabaseAdmin
      .from('messages')
      .select('id')
      .eq('session_id', sessionId)
      .eq('waha_message_id', wahaMessageId)
      .single();

    if (existing) {
      console.log(`[Webhook] Message already exists: ${wahaMessageId}`);
      return;
    }

    // Prepare message data
    const messageRecord = {
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

    console.log(`[Webhook] Message saved: ${wahaMessageId}`);

    // Handle media if present
    if (hasMedia && mediaUrl) {
      try {
        await downloadAndUploadMedia(insertedMessage.id, mediaUrl, messageData);
      } catch (mediaError) {
        console.error('[Webhook] Media processing error:', mediaError);
        // Don't throw - message is saved even if media fails
      }
    }
  } catch (error) {
    console.error('[Webhook] handleIncomingMessage error:', error);
    throw error;
  }
}

/**
 * Handle message acknowledgment webhook
 */
async function handleMessageAck(sessionId, ackData) {
  try {
    const { id: wahaMessageId, ack } = ackData;

    // Update message ack status
    const { error } = await supabaseAdmin
      .from('messages')
      .update({ ack })
      .eq('session_id', sessionId)
      .eq('waha_message_id', wahaMessageId);

    if (error) {
      console.error('[Webhook] ACK update error:', error);
      throw error;
    }

    console.log(`[Webhook] Message ACK updated: ${wahaMessageId} -> ${ack}`);
  } catch (error) {
    console.error('[Webhook] handleMessageAck error:', error);
    throw error;
  }
}

/**
 * Handle session status change webhook
 */
async function handleSessionStatus(sessionId, statusData) {
  try {
    const { status } = statusData;

    console.log(`[Webhook] Session status changed: ${status}`);

    // Update session status in database
    const updateData = {
      status: status.toUpperCase(),
      waha_metadata: statusData
    };

    if (status === 'CONNECTED') {
      updateData.last_connected_at = new Date().toISOString();
    }

    const { error } = await supabaseAdmin
      .from('sessions')
      .update(updateData)
      .eq('id', sessionId);

    if (error) {
      throw error;
    }

    // If session just connected, trigger gap-fill sync
    if (status === 'CONNECTED') {
      console.log(`[Webhook] Session connected - triggering gap-fill sync`);
      // Run sync in background (don't await)
      triggerGapFillSync(sessionId).catch(err => {
        console.error('[Webhook] Gap-fill sync error:', err);
      });
    }
  } catch (error) {
    console.error('[Webhook] handleSessionStatus error:', error);
    throw error;
  }
}

module.exports = {
  handleIncomingMessage,
  handleMessageAck,
  handleSessionStatus
};
