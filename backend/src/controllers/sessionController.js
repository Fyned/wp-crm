/**
 * WhatsApp Session Controller
 * Manages WAHA sessions
 */

const { supabaseAdmin } = require('../config/database');
const wahaClient = require('../config/waha');

/**
 * Create a new WhatsApp session
 * POST /api/sessions
 */
async function createSession(req, res) {
  try {
    const { session_name } = req.body;
    const adminId = req.profile.id;

    // Check if session name already exists
    const { data: existing } = await supabaseAdmin
      .from('sessions')
      .select('id')
      .eq('session_name', session_name)
      .single();

    if (existing) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'Session name already exists'
      });
    }

    // Create session in WAHA
    try {
      await wahaClient.post('/api/sessions', {
        name: session_name,
        config: {
          webhooks: [
            {
              url: `${process.env.API_BASE_URL}/api/webhooks/waha`,
              events: ['message', 'message.ack', 'session.status']
            }
          ]
        }
      });
    } catch (wahaError) {
      console.error('[Session] WAHA error:', wahaError.response?.data);
      return res.status(500).json({
        error: 'WAHA Error',
        message: 'Failed to create session in WAHA'
      });
    }

    // Create session in database
    const { data: session, error } = await supabaseAdmin
      .from('sessions')
      .insert({
        session_name,
        status: 'DISCONNECTED',
        created_by_admin_id: adminId
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.status(201).json({
      success: true,
      data: session
    });
  } catch (error) {
    console.error('[Session] Create error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create session'
    });
  }
}

/**
 * Get all sessions accessible to current user
 * GET /api/sessions
 */
async function getSessions(req, res) {
  try {
    const { role, id: userId } = req.profile;

    let query = supabaseAdmin
      .from('sessions')
      .select(`
        id,
        session_name,
        phone_number,
        status,
        last_connected_at,
        last_message_timestamp,
        created_at
      `);

    // Super admin sees all
    if (role === 'super_admin') {
      // No filter
    } else if (role === 'admin') {
      // Admin sees only their sessions
      query = query.eq('created_by_admin_id', userId);
    } else {
      // Team member sees assigned sessions
      // Get assigned session IDs
      const { data: assignments } = await supabaseAdmin
        .from('session_assignments')
        .select('session_id, assigned_to_team_id')
        .or(`assigned_to_user_id.eq.${userId},assigned_to_team_id.in.(SELECT team_id FROM team_members WHERE user_id = '${userId}')`);

      const sessionIds = assignments?.map(a => a.session_id) || [];

      if (sessionIds.length === 0) {
        return res.json({ success: true, data: [] });
      }

      query = query.in('id', sessionIds);
    }

    const { data: sessions, error } = await query.order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      data: sessions
    });
  } catch (error) {
    console.error('[Session] Get sessions error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch sessions'
    });
  }
}

/**
 * Get QR code for session
 * GET /api/sessions/:sessionId/qr
 */
async function getQRCode(req, res) {
  try {
    const { sessionId } = req.params;

    // Verify user has access to session
    const hasAccess = await checkSessionAccess(sessionId, req.profile);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied to this session'
      });
    }

    // Get session from DB
    const { data: session } = await supabaseAdmin
      .from('sessions')
      .select('session_name, status')
      .eq('id', sessionId)
      .single();

    if (!session) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Session not found'
      });
    }

    // Start session if not started
    if (session.status === 'DISCONNECTED') {
      await wahaClient.post(`/api/sessions/${session.session_name}/start`);
    }

    // Get QR code from WAHA
    const qrResponse = await wahaClient.get(
      `/api/sessions/${session.session_name}/auth/qr`,
      { responseType: 'arraybuffer' }
    );

    res.set('Content-Type', 'image/png');
    res.send(qrResponse.data);
  } catch (error) {
    console.error('[Session] QR code error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get QR code'
    });
  }
}

/**
 * Request pairing code
 * POST /api/sessions/:sessionId/pairing-code
 */
async function requestPairingCode(req, res) {
  try {
    const { sessionId } = req.params;
    const { phone_number } = req.body;

    // Verify access
    const hasAccess = await checkSessionAccess(sessionId, req.profile);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied'
      });
    }

    // Get session
    const { data: session } = await supabaseAdmin
      .from('sessions')
      .select('session_name, status')
      .eq('id', sessionId)
      .single();

    if (!session) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Session not found'
      });
    }

    // Request pairing code from WAHA
    const response = await wahaClient.post(
      `/api/sessions/${session.session_name}/auth/request-code`,
      { phoneNumber: phone_number }
    );

    // Update phone number in DB
    await supabaseAdmin
      .from('sessions')
      .update({ phone_number })
      .eq('id', sessionId);

    res.json({
      success: true,
      data: {
        code: response.data.code,
        phone_number
      }
    });
  } catch (error) {
    console.error('[Session] Pairing code error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to request pairing code'
    });
  }
}

/**
 * Assign session to user or team
 * POST /api/sessions/:sessionId/assign
 */
async function assignSession(req, res) {
  try {
    const { sessionId } = req.params;
    const { assigned_to_user_id, assigned_to_team_id } = req.body;
    const adminId = req.profile.id;

    // Verify admin owns this session
    const { data: session } = await supabaseAdmin
      .from('sessions')
      .select('created_by_admin_id')
      .eq('id', sessionId)
      .single();

    if (!session) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Session not found'
      });
    }

    if (req.profile.role !== 'super_admin' && session.created_by_admin_id !== adminId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only assign your own sessions'
      });
    }

    // Create assignment
    const { data: assignment, error } = await supabaseAdmin
      .from('session_assignments')
      .insert({
        session_id: sessionId,
        assigned_to_user_id,
        assigned_to_team_id,
        assigned_by_admin_id: adminId
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.status(201).json({
      success: true,
      data: assignment
    });
  } catch (error) {
    console.error('[Session] Assign error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to assign session'
    });
  }
}

/**
 * Delete session
 * DELETE /api/sessions/:sessionId
 */
async function deleteSession(req, res) {
  try {
    const { sessionId } = req.params;

    // Get session
    const { data: session } = await supabaseAdmin
      .from('sessions')
      .select('session_name, created_by_admin_id')
      .eq('id', sessionId)
      .single();

    if (!session) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Session not found'
      });
    }

    // Check permissions
    if (req.profile.role !== 'super_admin' && session.created_by_admin_id !== req.profile.id) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions'
      });
    }

    // Delete from WAHA
    try {
      await wahaClient.delete(`/api/sessions/${session.session_name}`);
    } catch (wahaError) {
      console.error('[Session] WAHA delete error:', wahaError);
    }

    // Delete from database (cascade will handle related records)
    await supabaseAdmin
      .from('sessions')
      .delete()
      .eq('id', sessionId);

    res.json({
      success: true,
      message: 'Session deleted successfully'
    });
  } catch (error) {
    console.error('[Session] Delete error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete session'
    });
  }
}

/**
 * Helper: Check if user has access to session
 */
async function checkSessionAccess(sessionId, profile) {
  if (profile.role === 'super_admin') {
    return true;
  }

  const { data: session } = await supabaseAdmin
    .from('sessions')
    .select('created_by_admin_id')
    .eq('id', sessionId)
    .single();

  if (profile.role === 'admin' && session?.created_by_admin_id === profile.id) {
    return true;
  }

  // Check assignments
  const { data: assignments } = await supabaseAdmin
    .from('session_assignments')
    .select('id, assigned_to_team_id')
    .eq('session_id', sessionId);

  for (const assignment of assignments || []) {
    if (assignment.assigned_to_user_id === profile.id) {
      return true;
    }

    if (assignment.assigned_to_team_id) {
      const { data: membership } = await supabaseAdmin
        .from('team_members')
        .select('id')
        .eq('team_id', assignment.assigned_to_team_id)
        .eq('user_id', profile.id)
        .single();

      if (membership) {
        return true;
      }
    }
  }

  return false;
}

module.exports = {
  createSession,
  getSessions,
  getQRCode,
  requestPairingCode,
  assignSession,
  deleteSession
};
