/**
 * Chat Page - WhatsApp Web Clone
 */

import { useEffect, useState } from 'react';
import { useChatStore } from '../stores/chatStore';
import { useAuthStore } from '../stores/authStore';
import ChatSidebar from '../components/chat/ChatSidebar';
import ChatWindow from '../components/chat/ChatWindow';
import SessionModal from '../components/modals/SessionModal';

export default function ChatPage() {
  const { user } = useAuthStore();
  const { currentSession, fetchSessions } = useChatStore();
  const [showSessionModal, setShowSessionModal] = useState(false);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const isAdmin = ['admin', 'super_admin'].includes(user?.role);

  return (
    <div className="h-screen flex bg-wa-bg">
      {/* Sidebar */}
      <ChatSidebar
        onNewSession={() => setShowSessionModal(true)}
        isAdmin={isAdmin}
      />

      {/* Chat Window */}
      {currentSession ? (
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
            <p className="text-gray-500">
              Select a session from the sidebar to start messaging
            </p>
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
