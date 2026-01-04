/**
 * WhatsApp Session Controller
 * Manages Evolution API instances
 */

const { supabaseAdmin } = require('../config/database');
const {
  createInstance,
  getInstanceStatus,
  getQRCode,
  requestPairingCode,
  deleteInstance,
  setWebhook
} = require('../config/evolution');

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

    // Create instance in Evolution API
    try {
      const evolutionResponse = await createInstance(session_name);

      // Set webhook for this instance
      // Use WEBHOOK_BASE_URL for internal Docker->Backend communication
      // or API_BASE_URL for external access
      const webhookUrl = process.env.WEBHOOK_BASE_URL
        ? `${process.env.WEBHOOK_BASE_URL}/api/webhooks/evolution`
        : `${process.env.API_BASE_URL}/api/webhooks/evolution`;

      console.log('[Session] Setting webhook URL:', webhookUrl);

      await setWebhook(
        session_name,
        webhookUrl,
        [
          'QRCODE_UPDATED',
          'CONNECTION_UPDATE',
          'MESSAGES_SET',
          'MESSAGES_UPSERT',
          'MESSAGES_UPDATE',
          'SEND_MESSAGE',
          'CONTACTS_SET',
          'CONTACTS_UPSERT',
          'CONTACTS_UPDATE',
          'CHATS_SET',
          'CHATS_UPSERT',
          'CHATS_UPDATE'
        ]
      );

      console.log('[Session] Evolution API instance created:', evolutionResponse);
    } catch (evolutionError) {
      console.error('[Session] Evolution API error:', evolutionError.response?.data || evolutionError.message);
      return res.status(500).json({
        error: 'Evolution API Error',
        message: 'Failed to create instance in Evolution API'
      });
    }

    // Create session in database
    const { data: session, error } = await supabaseAdmin
      .from('sessions')
      .insert({
        session_name,
        status: 'DISCONNECTED',
        created_by_admin_id: adminId,
        waha_metadata: {
          evolution_instance: session_name,
          created_at: new Date().toISOString()
        }
      })
      .select()
      .single();

    if (error) {
      // Rollback: delete from Evolution API
      try {
        await deleteInstance(session_name);
      } catch (rollbackError) {
        console.error('[Session] Rollback error:', rollbackError);
      }
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
      const { data: assignments } = await supabaseAdmin
        .from('session_assignments')
        .select('session_id')
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

    // Enrich with Evolution API status
    const enrichedSessions = await Promise.all(
      sessions.map(async (session) => {
        try {
          const status = await getInstanceStatus(session.session_name);
          return {
            ...session,
            evolution_status: status
          };
        } catch (err) {
          return {
            ...session,
            evolution_status: null
          };
        }
      })
    );

    res.json({
      success: true,
      data: enrichedSessions
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
async function getSessionQRCode(req, res) {
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

    // Get QR code from Evolution API
    const qrData = await getQRCode(session.session_name);

    // Return QR code data (base64 or image URL)
    res.json({
      success: true,
      data: {
        qrcode: qrData.base64 || qrData.code,
        pairingCode: qrData.pairingCode
      }
    });
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
async function requestSessionPairingCode(req, res) {
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

    // Request pairing code from Evolution API
    const pairingData = await requestPairingCode(session.session_name, phone_number);

    // Update phone number in DB
    await supabaseAdmin
      .from('sessions')
      .update({ phone_number })
      .eq('id', sessionId);

    res.json({
      success: true,
      data: {
        code: pairingData.code || pairingData.pairingCode,
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
      .select(`
        id,
        session_id,
        assigned_to_user_id,
        assigned_to_team_id,
        assigned_at,
        assigned_user:profiles!session_assignments_assigned_to_user_id_fkey(id, username, full_name),
        assigned_team:teams!session_assignments_assigned_to_team_id_fkey(id, name)
      `)
      .single();

    if (error) {
      throw error;
    }

    console.log(`[Session] Session ${sessionId} assigned to ${assigned_to_user_id ? 'user' : 'team'}`);

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
 * Get session assignments
 * GET /api/sessions/:sessionId/assignments
 */
async function getSessionAssignments(req, res) {
  try {
    const { sessionId } = req.params;

    // Verify access
    const hasAccess = await checkSessionAccess(sessionId, req.profile);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied'
      });
    }

    // Get all assignments for this session
    const { data: assignments, error } = await supabaseAdmin
      .from('session_assignments')
      .select(`
        id,
        session_id,
        assigned_to_user_id,
        assigned_to_team_id,
        assigned_at,
        assigned_user:profiles!session_assignments_assigned_to_user_id_fkey(id, username, full_name),
        assigned_team:teams!session_assignments_assigned_to_team_id_fkey(id, name)
      `)
      .eq('session_id', sessionId);

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      data: assignments || []
    });
  } catch (error) {
    console.error('[Session] Get assignments error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get session assignments'
    });
  }
}

/**
 * Unassign session (remove assignment)
 * DELETE /api/sessions/:sessionId/assignments/:assignmentId
 */
async function unassignSession(req, res) {
  try {
    const { sessionId, assignmentId } = req.params;
    const adminId = req.profile.id;

    // Get assignment to verify ownership
    const { data: assignment } = await supabaseAdmin
      .from('session_assignments')
      .select('id, session_id, session:sessions(created_by_admin_id)')
      .eq('id', assignmentId)
      .eq('session_id', sessionId)
      .single();

    if (!assignment) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Assignment not found'
      });
    }

    // Check permissions
    if (req.profile.role !== 'super_admin' && assignment.session.created_by_admin_id !== adminId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only unassign your own sessions'
      });
    }

    // Delete assignment
    const { error } = await supabaseAdmin
      .from('session_assignments')
      .delete()
      .eq('id', assignmentId);

    if (error) {
      throw error;
    }

    console.log(`[Session] Assignment ${assignmentId} removed`);

    res.json({
      success: true,
      message: 'Assignment removed successfully'
    });
  } catch (error) {
    console.error('[Session] Unassign error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to remove assignment'
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

    // Delete from Evolution API
    try {
      await deleteInstance(session.session_name);
    } catch (evolutionError) {
      console.error('[Session] Evolution API delete error:', evolutionError);
      // Continue with DB deletion even if Evolution API fails
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
 * Get session details
 * GET /api/sessions/:sessionId
 */
async function getSessionDetails(req, res) {
  try {
    const { sessionId } = req.params;

    // Verify access
    const hasAccess = await checkSessionAccess(sessionId, req.profile);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied'
      });
    }

    // Get session from DB
    const { data: session, error } = await supabaseAdmin
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error || !session) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Session not found'
      });
    }

    // Get Evolution API status
    try {
      const evolutionStatus = await getInstanceStatus(session.session_name);
      session.evolution_status = evolutionStatus;
    } catch (err) {
      session.evolution_status = null;
    }

    res.json({
      success: true,
      data: session
    });
  } catch (error) {
    console.error('[Session] Get details error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get session details'
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

/**
 * Reconnect a disconnected session
 * POST /api/sessions/:sessionId/reconnect
 * Returns QR code or pairing code for reconnection
 */
async function reconnectSession(req, res) {
  try {
    const { sessionId } = req.params;
    const { method = 'qr' } = req.body; // 'qr' or 'pairing'

    // Get session
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Session not found'
      });
    }

    console.log(`[Session] Reconnecting session: ${session.session_name} using ${method}`);

    // Check current Evolution API status
    try {
      const status = await getInstanceStatus(session.session_name);

      if (status.state === 'open') {
        return res.json({
          success: true,
          message: 'Session already connected',
          status: 'CONNECTED'
        });
      }
    } catch (error) {
      // Instance might not exist, will recreate
      console.log('[Session] Instance not found, recreating...');
    }

    // Recreate instance if needed
    try {
      await createInstance(session.session_name);

      // Set webhook
      const webhookUrl = process.env.WEBHOOK_BASE_URL
        ? `${process.env.WEBHOOK_BASE_URL}/api/webhooks/evolution`
        : `${process.env.API_BASE_URL}/api/webhooks/evolution`;

      await setWebhook(
        session.session_name,
        webhookUrl,
        [
          'QRCODE_UPDATED',
          'CONNECTION_UPDATE',
          'MESSAGES_SET',
          'MESSAGES_UPSERT',
          'MESSAGES_UPDATE',
          'MESSAGES_DELETE',
          'SEND_MESSAGE',
          'CONTACTS_SET',
          'CONTACTS_UPSERT',
          'CONTACTS_UPDATE',
          'CHATS_SET',
          'CHATS_UPSERT',
          'CHATS_UPDATE',
          'CHATS_DELETE'
        ]
      );
    } catch (createError) {
      console.error('[Session] Instance recreation error:', createError);
      // Continue anyway - instance might already exist
    }

    // Get QR code or pairing code based on method
    if (method === 'pairing') {
      // Pairing code method
      const phone = req.body.phone;

      if (!phone) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Phone number required for pairing method'
        });
      }

      const pairingData = await requestPairingCode(session.session_name, phone);

      return res.json({
        success: true,
        method: 'pairing',
        data: {
          code: pairingData.code,
          phone: phone
        }
      });
    } else {
      // QR code method (default)
      const qrData = await getQRCode(session.session_name);

      return res.json({
        success: true,
        method: 'qr',
        data: {
          qrcode: qrData.base64 || qrData.code,
          pairingCode: qrData.pairingCode
        }
      });
    }
  } catch (error) {
    console.error('[Session] Reconnect error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to reconnect session'
    });
  }
}

/**
 * Trigger gap-fill sync (pull missed messages)
 * POST /api/sessions/:sessionId/gap-fill
 * Optional feature to sync messages missed during disconnect
 */
async function triggerGapFillSync(req, res) {
  try {
    const { sessionId } = req.params;

    // Get session
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Session not found'
      });
    }

    // Check if session is connected
    if (session.status !== 'CONNECTED') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Session must be connected to sync messages'
      });
    }

    console.log(`[Session] Gap-fill sync requested for: ${session.session_name}`);

    // Import and trigger gap-fill sync
    const { triggerGapFillSync: doGapFill } = require('../services/syncService.evolution');

    // Start sync in background
    doGapFill(session.id).then(() => {
      console.log(`[Session] Gap-fill sync completed for: ${session.session_name}`);
    }).catch(error => {
      console.error('[Session] Gap-fill sync error:', error);
    });

    // Return immediately
    res.json({
      success: true,
      message: 'Gap-fill sync started. This may take a few minutes depending on message volume.',
      status: 'syncing'
    });
  } catch (error) {
    console.error('[Session] Gap-fill trigger error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to trigger gap-fill sync'
    });
  }
}

module.exports = {
  createSession,
  getSessions,
  getSessionQRCode,
  requestSessionPairingCode,
  assignSession,
  getSessionAssignments,
  unassignSession,
  deleteSession,
  getSessionDetails,
  reconnectSession,
  triggerGapFillSync
};
