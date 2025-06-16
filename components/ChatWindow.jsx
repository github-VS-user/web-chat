import React, { useEffect, useRef } from 'react';

export default function ChatWindow({ messages = [], typingUser, username }) {
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, typingUser]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-2 w-full px-4">
      {messages.map(msg => (
        <div
          key={msg.id}
          className={`flex ${msg.user === username ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`p-2 rounded-lg max-w-xs break-words ${
              msg.user === username
                ? 'bg-blue-200 text-right'
                : msg.user === 'System'
                ? 'bg-gray-200 italic text-gray-600 text-center mx-auto'
                : 'bg-white text-left'
            }`}
          >
            {msg.user !== 'System' && (
              <span className="font-bold">{msg.user}: </span>
            )}
            {msg.text}
          </div>
        </div>
      ))}
      {typingUser && typingUser !== username && (
        <div className="text-sm text-gray-500 italic">{typingUser} is typing...</div>
      )}
      <div ref={chatEndRef} />
    </div>
  );
}
