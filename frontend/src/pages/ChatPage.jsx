/**
 * Chat Page - Professional 3-Column WhatsApp CRM
 * Layout: Sessions List | Chats List | Messages Window
 */

import { useEffect, useState } from 'react';
import { useChatStore } from '../stores/chatStore';
import { useAuthStore } from '../stores/authStore';
import SessionsList from '../components/chat/SessionsList';
import ChatsList from '../components/chat/ChatsList';
import ChatWindow from '../components/chat/ChatWindow';
import SessionModal from '../components/modals/SessionModal';
import { usePermissions } from '../utils/permissions';

export default function ChatPage() {
  const { user } = useAuthStore();
  const { currentSession, currentChat, fetchSessions } = useChatStore();
  const [showSessionModal, setShowSessionModal] = useState(false);
  const permissions = usePermissions(user?.role);

  useEffect(() => {
    // Initial fetch
    fetchSessions();

    // Auto-refresh sessions every 10 seconds to detect connection status changes
    const interval = setInterval(() => {
      fetchSessions();
    }, 10000);

    return () => clearInterval(interval);
  }, [fetchSessions]);

  return (
    <div className="h-screen flex bg-wa-bg">
      {/* Left Column: Sessions List (250px) */}
      <SessionsList
        onNewSession={() => setShowSessionModal(true)}
        permissions={permissions}
      />

      {/* Middle Column: Chats List (350px) */}
      <ChatsList permissions={permissions} />

      {/* Right Column: Messages Window (Flexible) */}
      {currentChat ? (
        <ChatWindow />
      ) : (
        <div className="flex-1 flex items-center justify-center bg-wa-panel border-l border-wa-border">
          <div className="text-center">
            <svg
              className="w-64 h-64 mx-auto mb-8 text-wa-border"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
            </svg>
            <h2 className="text-2xl font-semibold text-gray-300 mb-2">
              WhatsApp CRM
            </h2>
            <p className="text-gray-500 mb-1">
              {currentSession
                ? 'Select a chat to view messages'
                : 'Select a session to start'}
            </p>
            {currentSession && currentSession.status !== 'CONNECTED' && (
              <p className="text-yellow-400 text-sm mt-2">
                ⚠️ Session disconnected - Reconnect to sync messages
              </p>
            )}
          </div>
        </div>
      )}

      {/* New Session Modal */}
      {showSessionModal && (
        <SessionModal onClose={() => setShowSessionModal(false)} />
      )}
    </div>
  );
}
