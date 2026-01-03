/**
 * API Client Service
 */

import axios from 'axios';
import { useAuthStore } from '../stores/authStore';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Create axios instance
const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - Add auth token
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Unauthorized - clear auth and redirect to login
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ===== Auth API =====

export const authAPI = {
  login: async (username, password) => {
    const response = await api.post('/auth/login', { username, password });
    return response.data;
  },

  getCurrentUser: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  logout: async () => {
    const response = await api.post('/auth/logout');
    return response.data;
  },
};

// ===== User Management API =====

export const userAPI = {
  createUser: async (userData) => {
    const response = await api.post('/users', userData);
    return response.data;
  },

  getUsers: async () => {
    const response = await api.get('/users');
    return response.data;
  },

  getUserById: async (userId) => {
    const response = await api.get(`/users/${userId}`);
    return response.data;
  },

  resetPassword: async (userId, newPassword) => {
    const response = await api.post(`/users/${userId}/reset-password`, {
      new_password: newPassword,
    });
    return response.data;
  },

  deactivateUser: async (userId) => {
    const response = await api.delete(`/users/${userId}`);
    return response.data;
  },

  reactivateUser: async (userId) => {
    const response = await api.post(`/users/${userId}/reactivate`);
    return response.data;
  },
};

// ===== Session API =====

export const sessionAPI = {
  createSession: async (sessionName) => {
    const response = await api.post('/sessions', { session_name: sessionName });
    return response.data;
  },

  getSessions: async () => {
    const response = await api.get('/sessions');
    return response.data;
  },

  getQRCode: async (sessionId) => {
    const response = await api.get(`/sessions/${sessionId}/qr`);
    return response.data.data.qrcode;
  },

  requestPairingCode: async (sessionId, phoneNumber) => {
    const response = await api.post(`/sessions/${sessionId}/pairing-code`, {
      phone_number: phoneNumber,
    });
    return response.data;
  },

  assignSession: async (sessionId, assignment) => {
    const response = await api.post(`/sessions/${sessionId}/assign`, assignment);
    return response.data;
  },

  deleteSession: async (sessionId) => {
    const response = await api.delete(`/sessions/${sessionId}`);
    return response.data;
  },

  // Reconnect session
  reconnectSession: async (sessionId) => {
    const response = await api.post(`/sessions/${sessionId}/reconnect`);
    return response.data;
  },

  // Sync operations
  syncInitial: async (sessionId, options = {}) => {
    const limit = options.limit || 10;
    const response = await api.post(`/sessions/${sessionId}/sync/initial?limit=${limit}`);
    return response.data;
  },

  syncGapFill: async (sessionId) => {
    const response = await api.post(`/sessions/${sessionId}/sync/gap-fill`);
    return response.data;
  },

  getSyncStatus: async (sessionId) => {
    const response = await api.get(`/sessions/${sessionId}/sync/status`);
    return response.data;
  },
};

// ===== Message API =====

export const messageAPI = {
  getChats: async (sessionId) => {
    const response = await api.get(`/sessions/${sessionId}/chats`);
    return response.data;
  },

  getMessages: async (sessionId, contactId, limit = 50, offset = 0) => {
    const response = await api.get(
      `/sessions/${sessionId}/contacts/${contactId}/messages`,
      { params: { limit, offset } }
    );
    return response.data;
  },

  sendMessage: async (sessionId, phoneNumber, message) => {
    const response = await api.post(`/sessions/${sessionId}/messages`, {
      phone_number: phoneNumber,
      message,
    });
    return response.data;
  },

  markAsRead: async (sessionId, contactId) => {
    const response = await api.post(
      `/sessions/${sessionId}/contacts/${contactId}/read`
    );
    return response.data;
  },

  searchMessages: async (sessionId, query) => {
    const response = await api.get(`/sessions/${sessionId}/search`, {
      params: { q: query },
    });
    return response.data;
  },
};

export default api;
