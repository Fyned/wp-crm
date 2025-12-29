/**
 * Message Controller for Evolution API
 */

const { supabaseAdmin } = require('../config/database');
const { sendTextMessage, sendMediaMessage, markMessageRead } = require('../config/evolution');

/**
 * Get chats for a session
 * GET /api/sessions/:sessionId/chats
 */
async function getChats(req, res) {
  try {
    const { sessionId } = req.params;

    // Use RPC function to get chat list with last message
    const { data: chats, error } = await supabaseAdmin
      .rpc('get_chat_list', { p_session_id: sessionId });

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      data: chats
    });
  } catch (error) {
    console.error('[Message] Get chats error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch chats'
    });
  }
}

/**
 * Get messages for a specific chat
 * GET /api/sessions/:sessionId/contacts/:contactId/messages
 */
async function getMessages(req, res) {
  try {
    const { sessionId, contactId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const { data: messages, error } = await supabaseAdmin
      .rpc('get_chat_messages', {
        p_session_id: sessionId,
        p_contact_id: contactId,
        p_limit: parseInt(limit),
        p_offset: parseInt(offset)
      });

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      data: messages
    });
  } catch (error) {
    console.error('[Message] Get messages error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch messages'
    });
  }
}

/**
 * Send a text message
 * POST /api/sessions/:sessionId/messages
 */
async function sendMessage(req, res) {
  try {
    const { sessionId } = req.params;
    const { phone_number, message, media_url, caption } = req.body;

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

    if (session.status !== 'CONNECTED') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Session is not connected'
      });
    }

    // Format phone number for Evolution API (add @s.whatsapp.net)
    const formattedNumber = phone_number.includes('@')
      ? phone_number
      : `${phone_number}@s.whatsapp.net`;

    let evolutionResponse;

    // Send via Evolution API
    if (media_url) {
      // Send media message
      evolutionResponse = await sendMediaMessage(
        session.session_name,
        formattedNumber,
        media_url,
        caption || message || ''
      );
    } else {
      // Send text message
      evolutionResponse = await sendTextMessage(
        session.session_name,
        formattedNumber,
        message
      );
    }

    res.json({
      success: true,
      data: {
        message_id: evolutionResponse.key?.id || evolutionResponse.messageId,
        timestamp: evolutionResponse.messageTimestamp || Date.now()
      }
    });
  } catch (error) {
    console.error('[Message] Send error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.response?.data?.message || 'Failed to send message'
    });
  }
}

/**
 * Mark messages as read
 * POST /api/sessions/:sessionId/contacts/:contactId/read
 */
async function markAsRead(req, res) {
  try {
    const { sessionId, contactId } = req.params;

    // Get session and contact
    const { data: session } = await supabaseAdmin
      .from('sessions')
      .select('session_name')
      .eq('id', sessionId)
      .single();

    const { data: contact } = await supabaseAdmin
      .from('contacts')
      .select('phone_number')
      .eq('id', contactId)
      .single();

    if (!session || !contact) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Session or contact not found'
      });
    }

    // Mark as read in database
    const { data: count, error } = await supabaseAdmin
      .rpc('mark_messages_read', {
        p_session_id: sessionId,
        p_contact_id: contactId
      });

    if (error) {
      throw error;
    }

    // Also mark as read in Evolution API (optional)
    try {
      const formattedNumber = `${contact.phone_number}@s.whatsapp.net`;
      await markMessageRead(session.session_name, formattedNumber, null);
    } catch (evolutionError) {
      console.error('[Message] Evolution API mark read error:', evolutionError);
      // Continue even if Evolution API call fails
    }

    res.json({
      success: true,
      data: {
        marked_count: count
      }
    });
  } catch (error) {
    console.error('[Message] Mark read error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to mark messages as read'
    });
  }
}

/**
 * Search messages
 * GET /api/sessions/:sessionId/search
 */
async function searchMessages(req, res) {
  try {
    const { sessionId } = req.params;
    const { q: searchQuery, limit = 50 } = req.query;

    if (!searchQuery) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Search query is required'
      });
    }

    const { data: results, error } = await supabaseAdmin
      .rpc('search_messages', {
        p_session_id: sessionId,
        p_search_query: searchQuery,
        p_limit: parseInt(limit)
      });

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('[Message] Search error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Search failed'
    });
  }
}

module.exports = {
  getChats,
  getMessages,
  sendMessage,
  markAsRead,
  searchMessages
};
