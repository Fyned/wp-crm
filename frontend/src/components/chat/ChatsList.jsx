/**
 * Chats List Component - Middle Column
 * Shows all chats for the selected session with metadata
 */

import { useState, useEffect } from 'react';
import { useChatStore } from '../../stores/chatStore';
import {
  MagnifyingGlassIcon,
  ArrowPathIcon,
  UserGroupIcon,
  TrashIcon,
  PencilIcon,
  TagIcon,
  StarIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { sessionAPI } from '../../services/api';
import toast from 'react-hot-toast';

export default function ChatsList({ permissions }) {
  const { currentSession, chats, currentChat, setCurrentChat, fetchChats } = useChatStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [editingChat, setEditingChat] = useState(null);
  const [customName, setCustomName] = useState('');
  const [notes, setNotes] = useState('');

  const filteredChats = chats.filter((chat) => {
    const searchLower = searchQuery.toLowerCase();
    const name = chat.custom_name || chat.name || chat.phone_number || '';
    return name.toLowerCase().includes(searchLower);
  });

  const handleSyncMessages = async () => {
    if (!currentSession) return;

    const syncType = confirm('Initial sync (OK) or Gap-fill sync (Cancel)?');

    try {
      toast.loading('Starting message sync...', { id: 'sync' });

      if (syncType) {
        // Initial sync with last 10 messages
        await sessionAPI.syncInitial(currentSession.id, { limit: 10 });
        toast.success('Initial sync started! Last 10 messages per chat.', { id: 'sync' });
      } else {
        // Gap-fill sync (all missed messages + media)
        await sessionAPI.syncGapFill(currentSession.id);
        toast.success('Gap-fill sync started! Downloading all media...', { id: 'sync' });
      }

      // Refresh chats after 3 seconds
      setTimeout(() => {
        fetchChats(currentSession.id);
      }, 3000);

    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to start sync', { id: 'sync' });
    }
  };

  const handleDeleteSession = async () => {
    if (!currentSession) return;

    if (!confirm(`Delete session "${currentSession.phone_number || currentSession.session_name}"?`)) {
      return;
    }

    try {
      await sessionAPI.deleteSession(currentSession.id);
      toast.success('Session deleted successfully');
      window.location.reload();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete session');
    }
  };

  const handleEditMetadata = (chat, e) => {
    e.stopPropagation();
    setEditingChat(chat.contact_id);
    setCustomName(chat.custom_name || '');
    setNotes(chat.notes || '');
  };

  const handleSaveMetadata = async (contactId) => {
    try {
      // TODO: API call to save chat metadata
      toast.success('Chat metadata saved');
      setEditingChat(null);
    } catch (error) {
      toast.error('Failed to save metadata');
    }
  };

  if (!currentSession) {
    return (
      <div className="w-96 bg-wa-panel border-r border-wa-border flex items-center justify-center">
        <div className="text-center text-gray-500 p-8">
          <UserGroupIcon className="w-16 h-16 mx-auto mb-3 text-gray-600" />
          <p className="text-sm">Select a session</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-96 bg-wa-panel flex flex-col border-r border-wa-border">
      {/* Header */}
      <div className="bg-wa-panel p-4 border-b border-wa-border">
        {/* Session Info */}
        <div className="mb-3">
          <h3 className="text-lg font-semibold text-white truncate">
            {currentSession.custom_label || currentSession.phone_number || currentSession.session_name}
          </h3>
          <p className="text-xs text-gray-400">
            {chats.length} chat{chats.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search chats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-2 bg-wa-bg border border-wa-border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2"
            >
              <XMarkIcon className="w-5 h-5 text-gray-400 hover:text-white" />
            </button>
          )}
        </div>

        {/* Action Buttons (Admin Only) */}
        {permissions?.isAdmin && (
          <div className="flex space-x-2 mt-3">
            <button
              onClick={handleSyncMessages}
              className="flex-1 flex items-center justify-center space-x-1 px-3 py-1.5 bg-blue-500/20 border border-blue-500/50 hover:bg-blue-500/30 rounded-lg text-xs text-blue-400 transition"
              title="Sync Messages"
            >
              <ArrowPathIcon className="w-3.5 h-3.5" />
              <span>Sync</span>
            </button>
            {permissions?.canDeleteSessions && (
              <button
                onClick={handleDeleteSession}
                className="flex-1 flex items-center justify-center space-x-1 px-3 py-1.5 bg-red-500/20 border border-red-500/50 hover:bg-red-500/30 rounded-lg text-xs text-red-400 transition"
                title="Delete Session"
              >
                <TrashIcon className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {filteredChats.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {searchQuery ? (
              <>
                <p className="text-sm">No chats found</p>
                <p className="text-xs mt-2">Try a different search term</p>
              </>
            ) : (
              <>
                <p className="text-sm">No chats yet</p>
                {currentSession.status !== 'CONNECTED' && (
                  <p className="text-xs mt-2 text-yellow-400">Session not connected</p>
                )}
                {currentSession.status === 'CONNECTED' && permissions?.isAdmin && (
                  <button
                    onClick={handleSyncMessages}
                    className="mt-3 px-4 py-2 bg-primary-500 text-white rounded-lg text-sm hover:bg-primary-600 transition"
                  >
                    Sync Messages
                  </button>
                )}
              </>
            )}
          </div>
        ) : (
          filteredChats.map((chat) => (
            <ChatItem
              key={chat.contact_id}
              chat={chat}
              isActive={currentChat?.contact_id === chat.contact_id}
              onClick={() => setCurrentChat(chat)}
              onEdit={handleEditMetadata}
              isEditing={editingChat === chat.contact_id}
              customName={customName}
              setCustomName={setCustomName}
              notes={notes}
              setNotes={setNotes}
              onSave={() => handleSaveMetadata(chat.contact_id)}
              onCancel={() => setEditingChat(null)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function ChatItem({
  chat,
  isActive,
  onClick,
  onEdit,
  isEditing,
  customName,
  setCustomName,
  notes,
  setNotes,
  onSave,
  onCancel
}) {
  const displayName = chat.custom_name || chat.name || formatPhoneNumber(chat.phone_number);
  const importance = chat.importance || 'normal';

  if (isEditing) {
    return (
      <div className="p-3 border-b border-wa-border bg-wa-bg">
        <input
          type="text"
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          placeholder="Custom name"
          className="w-full px-2 py-1 mb-2 bg-wa-panel border border-wa-border rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes..."
          rows={2}
          className="w-full px-2 py-1 mb-2 bg-wa-panel border border-wa-border rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
        <div className="flex space-x-2">
          <button
            onClick={onSave}
            className="flex-1 px-2 py-1 bg-primary-500 text-white rounded text-xs hover:bg-primary-600"
          >
            Save
          </button>
          <button
            onClick={onCancel}
            className="flex-1 px-2 py-1 bg-wa-panel border border-wa-border text-gray-300 rounded text-xs hover:bg-wa-hover"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`flex items-center p-4 cursor-pointer border-b border-wa-border hover:bg-wa-hover transition group ${
        isActive ? 'bg-wa-hover' : ''
      }`}
    >
      {/* Avatar */}
      <div className={`w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center text-white font-semibold ${
        importance === 'high' ? 'bg-red-600' : importance === 'medium' ? 'bg-yellow-600' : 'bg-gray-600'
      }`}>
        {displayName?.charAt(0).toUpperCase() || '?'}
      </div>

      {/* Chat Info */}
      <div className="ml-3 flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 flex-1 min-w-0">
            <h3 className="font-semibold text-white truncate">
              {displayName}
            </h3>
            {importance === 'high' && (
              <StarIcon className="w-4 h-4 text-yellow-400 flex-shrink-0" />
            )}
          </div>
          {chat.last_message_timestamp && (
            <span className="text-xs text-gray-400 ml-2 flex-shrink-0">
              {formatTime(chat.last_message_timestamp)}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between mt-1">
          <p className="text-sm text-gray-400 truncate flex-1">
            {chat.last_message_from_me && '✓ '}
            {chat.notes ? (
              <span className="italic text-gray-500">{chat.notes.substring(0, 30)}...</span>
            ) : (
              chat.last_message_body || 'No messages yet'
            )}
          </p>
          {chat.unread_count > 0 && (
            <span className="bg-primary-500 text-white text-xs font-semibold px-2 py-0.5 rounded-full ml-2 flex-shrink-0">
              {chat.unread_count}
            </span>
          )}
        </div>

        {/* Tags */}
        {chat.tags && chat.tags.length > 0 && (
          <div className="flex items-center space-x-1 mt-1">
            <TagIcon className="w-3 h-3 text-gray-500" />
            <div className="flex space-x-1">
              {chat.tags.slice(0, 3).map((tag, idx) => (
                <span key={idx} className="text-xs px-1.5 py-0.5 bg-wa-bg rounded text-gray-400">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Edit Button */}
      <button
        onClick={(e) => onEdit(chat, e)}
        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-wa-panel rounded transition ml-2"
        title="Edit metadata"
      >
        <PencilIcon className="w-4 h-4 text-gray-400" />
      </button>
    </div>
  );
}

function formatPhoneNumber(phoneNumber) {
  if (!phoneNumber) return '';

  const cleaned = phoneNumber.toString().replace(/\D/g, '');

  if (cleaned.startsWith('90') && cleaned.length >= 12) {
    const countryCode = cleaned.slice(0, 2);
    const areaCode = cleaned.slice(2, 5);
    const part1 = cleaned.slice(5, 8);
    const part2 = cleaned.slice(8, 10);
    const part3 = cleaned.slice(10, 12);
    return `+${countryCode} ${areaCode} ${part1} ${part2} ${part3}`;
  }

  if (cleaned.length > 10) {
    const countryCode = cleaned.slice(0, cleaned.length - 10);
    const rest = cleaned.slice(cleaned.length - 10);
    const part1 = rest.slice(0, 3);
    const part2 = rest.slice(3, 6);
    const part3 = rest.slice(6, 10);
    return `+${countryCode} ${part1} ${part2} ${part3}`;
  }

  return phoneNumber;
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;

  if (diff < 86400000) {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } else if (diff < 604800000) {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  } else {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }
}
