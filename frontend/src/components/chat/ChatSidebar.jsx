/**
 * Chat Sidebar Component
 */

import { useState, useEffect } from 'react';
import { useChatStore } from '../../stores/chatStore';
import { useAuthStore } from '../../stores/authStore';
import { PlusIcon, Cog6ToothIcon, ArrowRightOnRectangleIcon, TrashIcon, UserGroupIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';
import { sessionAPI } from '../../services/api';
import toast from 'react-hot-toast';

export default function ChatSidebar({ onNewSession, isAdmin }) {
  const navigate = useNavigate();
  const { logout, user } = useAuthStore();
  const { sessions, currentSession, setCurrentSession, chats, fetchChats } = useChatStore();
  const [selectedSessionId, setSelectedSessionId] = useState(null);

  useEffect(() => {
    if (sessions.length > 0 && !currentSession) {
      handleSessionSelect(sessions[0]);
    }
  }, [sessions]);

  const handleSessionSelect = async (session) => {
    setSelectedSessionId(session.id);
    await setCurrentSession(session);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleDeleteSession = async () => {
    if (!currentSession) return;

    if (!confirm(`Are you sure you want to delete session "${currentSession.session_name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await sessionAPI.deleteSession(currentSession.id);
      toast.success('Session deleted successfully');
      // Refresh sessions list
      window.location.reload();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete session');
    }
  };

  const handleAssignSession = async () => {
    if (!currentSession) return;

    const userId = prompt('Enter User ID to assign this session to (or leave empty for team assignment):');
    const teamId = userId ? null : prompt('Enter Team ID:');

    if (!userId && !teamId) {
      toast.error('Please provide either User ID or Team ID');
      return;
    }

    try {
      await sessionAPI.assignSession(currentSession.id, {
        assigned_to_user_id: userId || null,
        assigned_to_team_id: teamId || null
      });
      toast.success('Session assigned successfully');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to assign session');
    }
  };

  const handleSyncMessages = async () => {
    if (!currentSession) return;

    const syncType = confirm('Initial sync (OK) or Gap-fill sync (Cancel)?');

    try {
      toast.loading('Starting message sync...', { id: 'sync' });

      if (syncType) {
        // Initial sync
        await sessionAPI.syncInitial(currentSession.id);
        toast.success('Initial sync started! Check PM2 logs for progress.', { id: 'sync' });
      } else {
        // Gap-fill sync
        await sessionAPI.syncGapFill(currentSession.id);
        toast.success('Gap-fill sync started!', { id: 'sync' });
      }

      // Refresh chats after sync starts
      setTimeout(() => {
        fetchChats(currentSession.id);
      }, 3000);

    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to start sync', { id: 'sync' });
    }
  };

  return (
    <div className="w-96 bg-wa-panel flex flex-col border-r border-wa-border">
      {/* Header */}
      <div className="bg-wa-panel p-4 border-b border-wa-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary-500 rounded-full flex items-center justify-center text-white font-semibold">
              {user?.username?.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="font-semibold text-white">{user?.username}</h2>
              <p className="text-xs text-gray-400 capitalize">{user?.role?.replace('_', ' ')}</p>
            </div>
          </div>

          <div className="flex space-x-2">
            {isAdmin && (
              <>
                <button
                  onClick={onNewSession}
                  className="p-2 hover:bg-wa-hover rounded-full transition"
                  title="New Session"
                >
                  <PlusIcon className="w-6 h-6 text-gray-400" />
                </button>
                <button
                  onClick={() => navigate('/admin')}
                  className="p-2 hover:bg-wa-hover rounded-full transition"
                  title="Admin Panel"
                >
                  <Cog6ToothIcon className="w-6 h-6 text-gray-400" />
                </button>
              </>
            )}
            <button
              onClick={handleLogout}
              className="p-2 hover:bg-wa-hover rounded-full transition"
              title="Logout"
            >
              <ArrowRightOnRectangleIcon className="w-6 h-6 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Session Selector */}
        {sessions.length > 0 && (
          <div className="mt-4">
            <select
              value={selectedSessionId || ''}
              onChange={(e) => {
                const session = sessions.find((s) => s.id === e.target.value);
                if (session) handleSessionSelect(session);
              }}
              className="w-full px-3 py-2 bg-wa-bg border border-wa-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.phone_number || session.session_name} ({session.status})
                </option>
              ))}
            </select>

            {/* Session Management Buttons (Admin Only) */}
            {isAdmin && currentSession && (
              <div className="flex flex-col space-y-2 mt-2">
                <button
                  onClick={handleSyncMessages}
                  className="flex items-center justify-center space-x-2 px-3 py-2 bg-wa-bg border border-blue-500/50 hover:bg-blue-500/10 rounded-lg text-sm text-blue-400 transition"
                  title="Sync Messages"
                >
                  <ArrowPathIcon className="w-4 h-4" />
                  <span>Sync Messages</span>
                </button>
                <div className="flex space-x-2">
                  <button
                    onClick={handleAssignSession}
                    className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 bg-wa-bg border border-wa-border hover:bg-wa-hover rounded-lg text-sm text-gray-300 transition"
                    title="Assign Session"
                  >
                    <UserGroupIcon className="w-4 h-4" />
                    <span>Assign</span>
                  </button>
                  <button
                    onClick={handleDeleteSession}
                    className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 bg-wa-bg border border-red-500/50 hover:bg-red-500/10 rounded-lg text-sm text-red-400 transition"
                    title="Delete Session"
                  >
                    <TrashIcon className="w-4 h-4" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {chats.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p>No chats yet</p>
            {currentSession?.status !== 'CONNECTED' && (
              <p className="text-sm mt-2">Session not connected</p>
            )}
          </div>
        ) : (
          chats.map((chat) => (
            <ChatListItem key={chat.contact_id} chat={chat} />
          ))
        )}
      </div>
    </div>
  );
}

function ChatListItem({ chat }) {
  const { currentChat, setCurrentChat } = useChatStore();
  const isActive = currentChat?.contact_id === chat.contact_id;

  return (
    <div
      onClick={() => setCurrentChat(chat)}
      className={`flex items-center p-4 cursor-pointer border-b border-wa-border hover:bg-wa-hover transition ${
        isActive ? 'bg-wa-hover' : ''
      }`}
    >
      {/* Avatar */}
      <div className="w-12 h-12 bg-gray-600 rounded-full flex-shrink-0 flex items-center justify-center text-white font-semibold">
        {chat.name?.charAt(0).toUpperCase() || chat.phone_number?.charAt(0)}
      </div>

      {/* Chat Info */}
      <div className="ml-4 flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-white truncate">
            {chat.name || chat.phone_number}
          </h3>
          {chat.last_message_timestamp && (
            <span className="text-xs text-gray-400 ml-2">
              {formatTime(chat.last_message_timestamp)}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between mt-1">
          <p className="text-sm text-gray-400 truncate">
            {chat.last_message_from_me && '✓ '}
            {chat.last_message_body || 'No messages yet'}
          </p>
          {chat.unread_count > 0 && (
            <span className="bg-primary-500 text-white text-xs font-semibold px-2 py-1 rounded-full ml-2">
              {chat.unread_count}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;

  if (diff < 86400000) {
    // Less than 24 hours
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } else if (diff < 604800000) {
    // Less than 7 days
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  } else {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }
}
