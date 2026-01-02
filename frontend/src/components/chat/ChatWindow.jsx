/**
 * Chat Window Component
 */

import { useState, useEffect, useRef } from 'react';
import { useChatStore } from '../../stores/chatStore';
import { PaperAirplaneIcon, CheckIcon, CheckCircleIcon } from '@heroicons/react/24/solid';

export default function ChatWindow() {
  const {
    currentSession,
    currentChat,
    messages,
    isLoadingMessages,
    sendMessage,
    isSendingMessage,
  } = useChatStore();

  const [messageText, setMessageText] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageText.trim() || isSendingMessage) return;

    const success = await sendMessage(
      currentSession.id,
      currentChat.phone_number,
      messageText
    );

    if (success) {
      setMessageText('');
    }
  };

  if (!currentChat) {
    return (
      <div className="flex-1 flex items-center justify-center bg-wa-panel">
        <p className="text-gray-500">Select a chat to start messaging</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-wa-bg">
      {/* Chat Header */}
      <div className="bg-wa-panel p-4 border-b border-wa-border flex items-center">
        <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center text-white font-semibold">
          {currentChat.name?.charAt(0).toUpperCase() || 'U'}
        </div>
        <div className="ml-4">
          <h2 className="font-semibold text-white">
            {currentChat.name || currentChat.phone_number}
          </h2>
          <p className="text-xs text-gray-400">{currentChat.phone_number}</p>
        </div>
      </div>

      {/* Messages Area */}
      <div
        className="flex-1 overflow-y-auto p-6 space-y-3 scrollbar-thin"
        style={{
          backgroundImage: 'url(/chat-bg.png)',
          backgroundSize: 'cover',
        }}
      >
        {isLoadingMessages ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-10">
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="bg-wa-panel p-4 border-t border-wa-border">
        <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
          <input
            type="text"
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder="Type a message"
            className="flex-1 px-4 py-3 bg-wa-bg border border-wa-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            disabled={currentSession?.status !== 'CONNECTED'}
          />
          <button
            type="submit"
            disabled={!messageText.trim() || isSendingMessage || currentSession?.status !== 'CONNECTED'}
            className="p-3 bg-primary-500 hover:bg-primary-600 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <PaperAirplaneIcon className="w-6 h-6 text-white" />
          </button>
        </form>
        {currentSession?.status !== 'CONNECTED' && (
          <p className="text-xs text-red-400 mt-2 text-center">
            Session not connected. Please reconnect to send messages.
          </p>
        )}
      </div>
    </div>
  );
}

function MessageBubble({ message }) {
  const isFromMe = message.from_me;
  const hasMedia = message.has_media && message.media_url;

  return (
    <div className={`flex ${isFromMe ? 'justify-end' : 'justify-start'} message-bubble`}>
      <div
        className={`max-w-md px-4 py-2 rounded-lg shadow ${
          isFromMe
            ? 'bg-wa-bubbleOut text-white'
            : 'bg-wa-panel text-white border border-wa-border'
        }`}
      >
        {/* Render Media */}
        {hasMedia && <MediaContent message={message} />}

        {/* Render Text Body */}
        {message.body && (
          <p className="text-sm break-words">{message.body}</p>
        )}

        <div className="flex items-center justify-end mt-1 space-x-1">
          <span className="text-xs text-gray-300 opacity-70">
            {formatMessageTime(message.timestamp)}
          </span>

          {isFromMe && <MessageAckIcon ack={message.ack} />}
        </div>
      </div>
    </div>
  );
}

function MediaContent({ message }) {
  const { media_url, media_mimetype, media_filename, message_type } = message;

  // IMAGE
  if (message_type === 'image' || media_mimetype?.startsWith('image/')) {
    return (
      <div className="mb-2">
        <img
          src={media_url}
          alt={media_filename || 'Image'}
          className="max-w-full rounded-lg cursor-pointer hover:opacity-90 transition"
          onClick={() => window.open(media_url, '_blank')}
          loading="lazy"
        />
      </div>
    );
  }

  // VIDEO
  if (message_type === 'video' || media_mimetype?.startsWith('video/')) {
    return (
      <div className="mb-2">
        <video
          src={media_url}
          controls
          className="max-w-full rounded-lg"
          preload="metadata"
        >
          Your browser does not support video playback.
        </video>
      </div>
    );
  }

  // AUDIO
  if (message_type === 'audio' || message_type === 'ptt' || media_mimetype?.startsWith('audio/')) {
    return (
      <div className="mb-2">
        <audio
          src={media_url}
          controls
          className="w-full"
          preload="metadata"
        >
          Your browser does not support audio playback.
        </audio>
      </div>
    );
  }

  // DOCUMENT (PDF, Word, Excel, etc.)
  if (message_type === 'document' || media_mimetype?.includes('application/')) {
    return (
      <div className="mb-2 bg-gray-700 rounded-lg p-3 flex items-center space-x-3">
        <div className="flex-shrink-0">
          <svg className="w-10 h-10 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
            <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">
            {media_filename || 'Document'}
          </p>
          <p className="text-xs text-gray-400">
            {getFileType(media_mimetype)}
          </p>
        </div>
        <a
          href={media_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 text-blue-400 hover:text-blue-300"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </a>
      </div>
    );
  }

  // STICKER
  if (message_type === 'sticker') {
    return (
      <div className="mb-2">
        <img
          src={media_url}
          alt="Sticker"
          className="max-w-xs rounded-lg"
          loading="lazy"
        />
      </div>
    );
  }

  // FALLBACK
  return (
    <div className="mb-2 text-xs text-gray-400">
      📎 {media_filename || 'Media file'}
    </div>
  );
}

function getFileType(mimetype) {
  if (!mimetype) return 'File';

  const typeMap = {
    'application/pdf': 'PDF Document',
    'application/msword': 'Word Document',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word Document',
    'application/vnd.ms-excel': 'Excel Spreadsheet',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel Spreadsheet',
    'application/vnd.ms-powerpoint': 'PowerPoint Presentation',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PowerPoint Presentation',
    'application/zip': 'ZIP Archive',
    'application/x-rar-compressed': 'RAR Archive',
    'text/plain': 'Text File',
  };

  return typeMap[mimetype] || mimetype.split('/')[1]?.toUpperCase() || 'File';
}

function MessageAckIcon({ ack }) {
  if (ack === 'READ' || ack === 'PLAYED') {
    return <CheckCircleIcon className="w-4 h-4 text-blue-400" />;
  }

  if (ack === 'DEVICE') {
    return (
      <div className="flex">
        <CheckIcon className="w-3 h-3 text-gray-300" />
        <CheckIcon className="w-3 h-3 text-gray-300 -ml-1" />
      </div>
    );
  }

  return <CheckIcon className="w-3 h-3 text-gray-400" />;
}

function formatMessageTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const timeStr = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  if (isToday) {
    return timeStr;
  } else if (isYesterday) {
    return `Yesterday ${timeStr}`;
  } else {
    const dateStr = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
    return `${dateStr} ${timeStr}`;
  }
}
