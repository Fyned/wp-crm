/**
 * Chat Store (Zustand)
 */

import { create } from 'zustand';
import { messageAPI, sessionAPI } from '../services/api';

export const useChatStore = create((set, get) => ({
  // Sessions
  sessions: [],
  currentSession: null,

  // Chats
  chats: [],
  currentChat: null,

  // Messages
  messages: [],
  isLoadingMessages: false,

  // UI State
  isLoadingChats: false,
  isSendingMessage: false,

  // ===== Sessions =====

  fetchSessions: async () => {
    try {
      const response = await sessionAPI.getSessions();
      set({ sessions: response.data });
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    }
  },

  setCurrentSession: async (session) => {
    set({ currentSession: session, currentChat: null, messages: [] });
    // Load chats for this session
    await get().fetchChats(session.id);
  },

  // ===== Chats =====

  fetchChats: async (sessionId) => {
    set({ isLoadingChats: true });
    try {
      const response = await messageAPI.getChats(sessionId);
      set({ chats: response.data, isLoadingChats: false });
    } catch (error) {
      console.error('Failed to fetch chats:', error);
      set({ isLoadingChats: false });
    }
  },

  setCurrentChat: async (chat) => {
    set({ currentChat: chat, isLoadingMessages: true });
    // Load messages for this chat
    await get().fetchMessages(get().currentSession.id, chat.contact_id);
  },

  // ===== Messages =====

  fetchMessages: async (sessionId, contactId, limit = 50, offset = 0) => {
    try {
      const response = await messageAPI.getMessages(sessionId, contactId, limit, offset);
      set({ messages: response.data.reverse(), isLoadingMessages: false });

      // Mark as read
      await messageAPI.markAsRead(sessionId, contactId);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
      set({ isLoadingMessages: false });
    }
  },

  sendMessage: async (sessionId, phoneNumber, message) => {
    set({ isSendingMessage: true });
    try {
      const response = await messageAPI.sendMessage(sessionId, phoneNumber, message);

      // Reload messages from database to get the saved message with proper ID
      const currentChat = get().currentChat;
      if (currentChat) {
        await get().fetchMessages(sessionId, currentChat.contact_id);
      }

      // Also refresh chat list to update last message
      await get().fetchChats(sessionId);

      set({ isSendingMessage: false });
      return true;
    } catch (error) {
      console.error('Failed to send message:', error);
      set({ isSendingMessage: false });
      return false;
    }
  },

  // Add incoming message (from webhook or polling)
  addMessage: (message) => {
    set((state) => {
      // Avoid duplicates
      if (state.messages.find((m) => m.id === message.id)) {
        return state;
      }
      return { messages: [...state.messages, message] };
    });
  },

  // Update message ACK status
  updateMessageAck: (messageId, ack) => {
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId ? { ...m, ack } : m
      ),
    }));
  },
}));
