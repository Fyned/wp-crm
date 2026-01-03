/**
 * Evolution API Client Configuration
 */

const axios = require('axios');

if (!process.env.EVOLUTION_API_URL || !process.env.EVOLUTION_API_KEY) {
  throw new Error('Missing Evolution API configuration. Please check your .env file.');
}

// Evolution API Client
const evolutionClient = axios.create({
  baseURL: process.env.EVOLUTION_API_URL,
  headers: {
    'apikey': process.env.EVOLUTION_API_KEY,
    'Content-Type': 'application/json'
  },
  timeout: 30000 // 30 seconds
});

// Request interceptor for logging
evolutionClient.interceptors.request.use(
  (config) => {
    console.log(`[Evolution API] ${config.method.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('[Evolution API] Request error:', error.message);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
evolutionClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      console.error('[Evolution API] API error:', error.response.status, error.response.data);
    } else if (error.request) {
      console.error('[Evolution API] No response received:', error.message);
    } else {
      console.error('[Evolution API] Request setup error:', error.message);
    }
    return Promise.reject(error);
  }
);

/**
 * Evolution API Helper Functions
 */

// Create a new instance (WhatsApp session)
async function createInstance(instanceName) {
  const response = await evolutionClient.post('/instance/create', {
    instanceName,
    qrcode: true,
    integration: 'WHATSAPP-BAILEYS'
  });
  return response.data;
}

// Get instance connection status
async function getInstanceStatus(instanceName) {
  const response = await evolutionClient.get(`/instance/connectionState/${instanceName}`);
  return response.data;
}

// Get QR Code
async function getQRCode(instanceName) {
  const response = await evolutionClient.get(`/instance/connect/${instanceName}`);
  return response.data;
}

// Request pairing code
async function requestPairingCode(instanceName, phoneNumber) {
  const response = await evolutionClient.post(`/instance/pairingCode`, {
    instanceName,
    phoneNumber
  });
  return response.data;
}

// Delete instance
async function deleteInstance(instanceName) {
  const response = await evolutionClient.delete(`/instance/delete/${instanceName}`);
  return response.data;
}

// Send text message
async function sendTextMessage(instanceName, phoneNumber, message) {
  const response = await evolutionClient.post(`/message/sendText/${instanceName}`, {
    number: phoneNumber,
    options: {
      delay: 1200,
      presence: 'composing'
    },
    textMessage: {
      text: message
    }
  });
  return response.data;
}

// Send media message
async function sendMediaMessage(instanceName, phoneNumber, mediaUrl, caption = '') {
  const response = await evolutionClient.post(`/message/sendMedia/${instanceName}`, {
    number: phoneNumber,
    options: {
      delay: 1200,
      presence: 'composing'
    },
    mediaMessage: {
      mediaUrl,
      caption
    }
  });
  return response.data;
}

// Get chat messages (from Evolution API's internal storage)
// NOTE: Evolution API v1.8.4 has a bug where remoteJid filter doesn't work
// Workaround: Fetch more messages and filter client-side
async function getChatMessages(instanceName, phoneNumber, limit = 50) {
  console.log(`[Evolution API] Fetching messages for ${phoneNumber} (with client-side filter workaround)`);

  // Fetch more messages than needed since API doesn't filter properly
  const fetchLimit = Math.max(limit * 10, 500); // Fetch 10x more to ensure we get enough

  const response = await evolutionClient.post(`/chat/findMessages/${instanceName}`, {
    where: {
      key: {
        remoteJid: phoneNumber
      }
    },
    limit: fetchLimit
  });

  const allMessages = response.data || [];
  console.log(`[Evolution API] Received ${allMessages.length} messages from API`);

  // Client-side filter: Only keep messages from this specific chat
  const filteredMessages = allMessages.filter(msg => {
    const msgRemoteJid = msg?.key?.remoteJid;
    return msgRemoteJid === phoneNumber;
  });

  console.log(`[Evolution API] Filtered to ${filteredMessages.length} messages for ${phoneNumber}`);

  // Sort by timestamp (newest first) and limit
  const sortedMessages = filteredMessages
    .sort((a, b) => (b.messageTimestamp || 0) - (a.messageTimestamp || 0))
    .slice(0, limit);

  console.log(`[Evolution API] Returning ${sortedMessages.length} most recent messages`);
  return sortedMessages;
}

// Get all chats (with pagination support to fetch ALL chats)
async function getAllChats(instanceName) {
  const allChats = [];
  let page = 1;
  const limit = 100; // Fetch 100 chats per page
  const MAX_PAGES = 50; // Safety limit: max 5000 chats (prevent infinite loop)
  const seenIds = new Set(); // Track chat IDs to detect duplicates

  while (page <= MAX_PAGES) {
    console.log(`[Evolution API] Fetching chats page ${page} for ${instanceName}...`);

    const response = await evolutionClient.get(`/chat/findChats/${instanceName}`, {
      params: { page, limit }
    });

    const chats = response.data || [];
    console.log(`[Evolution API] Page ${page} returned ${chats.length} chats`);

    if (chats.length === 0) {
      console.log(`[Evolution API] No more chats on page ${page}, stopping pagination`);
      break; // No more chats
    }

    // Check for duplicate chats (indicates pagination not working)
    let newChatsCount = 0;
    for (const chat of chats) {
      const chatId = chat.id;
      if (!seenIds.has(chatId)) {
        seenIds.add(chatId);
        allChats.push(chat);
        newChatsCount++;
      }
    }

    console.log(`[Evolution API] Added ${newChatsCount} new chats (${chats.length - newChatsCount} duplicates)`);

    // If all chats on this page were duplicates, pagination is broken - stop
    if (newChatsCount === 0) {
      console.log(`[Evolution API] All chats on page ${page} were duplicates - pagination appears broken, stopping`);
      break;
    }

    if (chats.length < limit) {
      console.log(`[Evolution API] Page ${page} has fewer than ${limit} chats, assuming last page`);
      break; // Last page
    }

    page++;
  }

  if (page > MAX_PAGES) {
    console.warn(`[Evolution API] Hit maximum page limit (${MAX_PAGES}), stopping pagination`);
  }

  console.log(`[Evolution API] Fetched total ${allChats.length} unique chats from ${page} pages`);
  return allChats;
}

// Mark message as read
async function markMessageRead(instanceName, phoneNumber, messageId) {
  const response = await evolutionClient.post(`/chat/markMessageRead/${instanceName}`, {
    remoteJid: phoneNumber,
    messageId
  });
  return response.data;
}

// Get instance info
async function getInstanceInfo(instanceName) {
  const response = await evolutionClient.get(`/instance/fetchInstances/${instanceName}`);
  return response.data;
}

// Logout instance
async function logoutInstance(instanceName) {
  const response = await evolutionClient.delete(`/instance/logout/${instanceName}`);
  return response.data;
}

// Restart instance
async function restartInstance(instanceName) {
  const response = await evolutionClient.put(`/instance/restart/${instanceName}`);
  return response.data;
}

// Set webhook for instance
async function setWebhook(instanceName, webhookUrl, events) {
  const response = await evolutionClient.post(`/webhook/set/${instanceName}`, {
    url: webhookUrl,
    enabled: true,
    webhookByEvents: true,
    events
  });
  return response.data;
}

// Download media (decrypts WhatsApp encrypted media)
async function downloadMedia(instanceName, messageId, convertToMp4 = false) {
  const response = await evolutionClient.post(`/message/downloadMedia/${instanceName}`, {
    key: {
      id: messageId
    },
    convertToMp4
  }, {
    responseType: 'arraybuffer' // Get binary data
  });
  return response.data;
}

module.exports = {
  evolutionClient,

  // Instance management
  createInstance,
  getInstanceStatus,
  getInstanceInfo,
  deleteInstance,
  logoutInstance,
  restartInstance,

  // Authentication
  getQRCode,
  requestPairingCode,

  // Messaging
  sendTextMessage,
  sendMediaMessage,
  getChatMessages,
  getAllChats,
  markMessageRead,
  downloadMedia,

  // Webhook
  setWebhook
};
