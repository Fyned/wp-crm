/**
 * Message Controller
 */

const { supabaseAdmin, createUserClient } = require('../config/database');
const wahaClient = require('../config/waha');

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
 * Send a message
 * POST /api/sessions/:sessionId/messages
 */
async function sendMessage(req, res) {
  try {
    const { sessionId } = req.params;
    const { phone_number, message, message_type = 'text' } = req.body;

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

    // Send via WAHA
    const wahaResponse = await wahaClient.post(
      `/api/sendText`,
      {
        session: session.session_name,
        chatId: phone_number,
        text: message
      }
    );

    res.json({
      success: true,
      data: {
        message_id: wahaResponse.data.id,
        timestamp: wahaResponse.data.timestamp
      }
    });
  } catch (error) {
    console.error('[Message] Send error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to send message'
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

    const { data: count, error } = await supabaseAdmin
      .rpc('mark_messages_read', {
        p_session_id: sessionId,
        p_contact_id: contactId
      });

    if (error) {
      throw error;
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
