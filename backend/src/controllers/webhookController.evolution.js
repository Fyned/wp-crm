/**
 * Webhook Controller for Evolution API
 * Handles incoming webhooks
 */

const {
  handleIncomingMessage,
  handleMessageAck,
  handleConnectionUpdate,
  handleQRCodeUpdate,
  handleContactsUpdate,
  handleChatsUpdate
} = require('../services/webhookService.evolution');

/**
 * Evolution API Webhook Handler
 * POST /api/webhooks/evolution
 */
async function handleEvolutionWebhook(req, res) {
  try {
    const payload = req.body;
    const { event, instance, data } = payload;

    console.log(`[Webhook] Received event: ${event} for instance: ${instance}`);

    // Normalize event name to uppercase for consistency
    const normalizedEvent = event?.toUpperCase().replace(/\./g, '_');

    // Route to appropriate handler based on event type
    switch (normalizedEvent) {
      case 'MESSAGES_UPSERT':
      case 'MESSAGES_SET':
        await handleIncomingMessage(instance, payload);
        break;

      case 'MESSAGES_UPDATE':
        await handleMessageAck(instance, payload);
        break;

      case 'CONNECTION_UPDATE':
        await handleConnectionUpdate(instance, data);
        break;

      case 'QRCODE_UPDATED':
        await handleQRCodeUpdate(instance, data);
        break;

      case 'CONTACTS_UPSERT':
      case 'CONTACTS_SET':
      case 'CONTACTS_UPDATE':
        await handleContactsUpdate(instance, payload);
        break;

      case 'CHATS_UPSERT':
      case 'CHATS_SET':
      case 'CHATS_UPDATE':
        await handleChatsUpdate(instance, payload);
        break;

      case 'SEND_MESSAGE':
        // Outgoing message confirmation - can be used for tracking
        console.log('[Webhook] Message sent confirmation');
        break;

      default:
        console.log(`[Webhook] Unhandled event type: ${event} (normalized: ${normalizedEvent})`);
    }

    // Always return 200 to acknowledge receipt
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('[Webhook] Error:', error);
    // Still return 200 to prevent Evolution API from retrying
    res.status(200).json({ success: false, error: error.message });
  }
}

/**
 * Webhook health check
 * GET /api/webhooks/health
 */
async function webhookHealth(req, res) {
  res.json({
    success: true,
    message: 'Webhook endpoint is healthy',
    timestamp: new Date().toISOString()
  });
}

module.exports = {
  handleEvolutionWebhook,
  webhookHealth
};
