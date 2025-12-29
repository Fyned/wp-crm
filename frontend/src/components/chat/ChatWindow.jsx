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

  return (
    <div className={`flex ${isFromMe ? 'justify-end' : 'justify-start'} message-bubble`}>
      <div
        className={`max-w-md px-4 py-2 rounded-lg shadow ${
          isFromMe
            ? 'bg-wa-bubbleOut text-white'
            : 'bg-wa-panel text-white border border-wa-border'
        }`}
      >
        <p className="text-sm break-words">{message.body}</p>

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
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}
