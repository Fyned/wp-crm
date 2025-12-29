/**
 * WAHA API Client Configuration
 */

const axios = require('axios');

if (!process.env.WAHA_BASE_URL || !process.env.WAHA_API_KEY) {
  throw new Error('Missing WAHA configuration. Please check your .env file.');
}

// WAHA API Client
const wahaClient = axios.create({
  baseURL: process.env.WAHA_BASE_URL,
  headers: {
    'X-Api-Key': process.env.WAHA_API_KEY,
    'Content-Type': 'application/json'
  },
  timeout: 30000 // 30 seconds
});

// Request interceptor for logging
wahaClient.interceptors.request.use(
  (config) => {
    console.log(`[WAHA] ${config.method.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('[WAHA] Request error:', error.message);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
wahaClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      console.error('[WAHA] API error:', error.response.status, error.response.data);
    } else if (error.request) {
      console.error('[WAHA] No response received:', error.message);
    } else {
      console.error('[WAHA] Request setup error:', error.message);
    }
    return Promise.reject(error);
  }
);

module.exports = wahaClient;
