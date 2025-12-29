/**
 * Webhook Controller
 * Handles incoming webhooks from WAHA
 */

const { supabaseAdmin } = require('../config/database');
const { handleIncomingMessage, handleMessageAck, handleSessionStatus } = require('../services/webhookService');

/**
 * WAHA Webhook Handler
 * POST /api/webhooks/waha
 */
async function handleWahaWebhook(req, res) {
  try {
    const payload = req.body;
    const { event, session, data } = payload;

    console.log(`[Webhook] Received event: ${event} for session: ${session}`);

    // Find session in database
    const { data: dbSession, error } = await supabaseAdmin
      .from('sessions')
      .select('id, session_name')
      .eq('session_name', session)
      .single();

    if (error || !dbSession) {
      console.error(`[Webhook] Session not found: ${session}`);
      return res.status(404).json({
        error: 'Not Found',
        message: 'Session not found'
      });
    }

    // Route to appropriate handler based on event type
    switch (event) {
      case 'message':
        await handleIncomingMessage(dbSession.id, data);
        break;

      case 'message.ack':
        await handleMessageAck(dbSession.id, data);
        break;

      case 'session.status':
        await handleSessionStatus(dbSession.id, data);
        break;

      default:
        console.log(`[Webhook] Unhandled event type: ${event}`);
    }

    // Always return 200 to acknowledge receipt
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('[Webhook] Error:', error);
    // Still return 200 to prevent WAHA from retrying
    res.status(200).json({ success: false, error: error.message });
  }
}

module.exports = {
  handleWahaWebhook
};
