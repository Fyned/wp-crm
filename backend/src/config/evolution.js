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
async function getChatMessages(instanceName, phoneNumber, limit = 50) {
  const response = await evolutionClient.post(`/chat/findMessages/${instanceName}`, {
    where: {
      key: {
        remoteJid: phoneNumber
      }
    },
    limit
  });
  return response.data;
}

// Get all chats
async function getAllChats(instanceName) {
  const response = await evolutionClient.get(`/chat/findChats/${instanceName}`);
  return response.data;
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

  // Webhook
  setWebhook
};
