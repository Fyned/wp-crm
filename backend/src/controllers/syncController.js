/**
 * Sync Controller
 * Handles message synchronization triggers
 */

const { initialMessageSync, triggerGapFillSync, triggerManualSync } = require('../services/syncService.evolution');
const { supabaseAdmin } = require('../config/database');

/**
 * Trigger initial message sync for a session
 * POST /api/sessions/:sessionId/sync/initial
 */
async function triggerInitialSync(req, res) {
  try {
    const { sessionId } = req.params;
    const userId = req.profile.id;

    console.log(`[Sync Controller] Initial sync requested for session: ${sessionId} by user: ${userId}`);

    // Verify session belongs to user (or user is super_admin)
    const { data: session } = await supabaseAdmin
      .from('sessions')
      .select('id, session_name, created_by_admin_id, status')
      .eq('id', sessionId)
      .single();

    if (!session) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Session not found'
      });
    }

    if (req.profile.role !== 'super_admin' && session.created_by_admin_id !== userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only sync your own sessions'
      });
    }

    if (session.status !== 'CONNECTED') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Session must be CONNECTED to sync'
      });
    }

    // Start sync in background (don't wait)
    initialMessageSync(sessionId, (progress) => {
      console.log(`[Sync Progress] ${progress.processedChats}/${progress.totalChats} chats, ${progress.totalMessages} messages`);
    }).catch(err => {
      console.error('[Sync Controller] Background sync error:', err);
    });

    // Return immediately
    res.json({
      success: true,
      message: 'Initial sync started in background',
      session_id: sessionId
    });

  } catch (error) {
    console.error('[Sync Controller] Trigger initial sync error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to start initial sync'
    });
  }
}

/**
 * Trigger gap-fill sync for a session
 * POST /api/sessions/:sessionId/sync/gap-fill
 */
async function triggerGapFill(req, res) {
  try {
    const { sessionId } = req.params;
    const userId = req.profile.id;

    console.log(`[Sync Controller] Gap-fill sync requested for session: ${sessionId}`);

    // Verify session access
    const { data: session } = await supabaseAdmin
      .from('sessions')
      .select('id, created_by_admin_id')
      .eq('id', sessionId)
      .single();

    if (!session) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Session not found'
      });
    }

    if (req.profile.role !== 'super_admin' && session.created_by_admin_id !== userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions'
      });
    }

    // Start gap-fill sync in background
    triggerGapFillSync(sessionId).catch(err => {
      console.error('[Sync Controller] Gap-fill error:', err);
    });

    res.json({
      success: true,
      message: 'Gap-fill sync started in background'
    });

  } catch (error) {
    console.error('[Sync Controller] Trigger gap-fill error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to start gap-fill sync'
    });
  }
}

/**
 * Get sync status for a session
 * GET /api/sessions/:sessionId/sync/status
 */
async function getSyncStatus(req, res) {
  try {
    const { sessionId } = req.params;

    const { data: syncState, error } = await supabaseAdmin
      .from('sync_state')
      .select('*')
      .eq('session_id', sessionId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      throw error;
    }

    res.json({
      success: true,
      data: syncState || {
        sync_status: 'idle',
        last_synced_at: null,
        total_messages_synced: 0
      }
    });

  } catch (error) {
    console.error('[Sync Controller] Get sync status error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get sync status'
    });
  }
}

module.exports = {
  triggerInitialSync,
  triggerGapFill,
  getSyncStatus
};
