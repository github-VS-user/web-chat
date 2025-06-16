import React, { useEffect, useRef } from 'react';

export default function ChatWindow({ messages = [], typingUser, username }) {
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, typingUser]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3 w-full px-6 bg-gray-50 dark:bg-gray-900">
      {messages.map(msg => (
        <div
          key={msg.id}
          className={`flex ${msg.user === username ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`relative p-3 max-w-xs break-words
              ${msg.user === username
                ? 'bg-blue-500 text-white rounded-tr-2xl rounded-br-2xl rounded-tl-xl shadow-lg'
                : msg.user === 'System'
                ? 'bg-gray-300 italic text-gray-700 text-center mx-auto rounded-xl'
                : 'bg-white text-gray-900 rounded-tl-2xl rounded-bl-2xl rounded-tr-xl shadow-md'}
            `}
          >
            {msg.user !== 'System' && (
              <span className="font-semibold">{msg.user}: </span>
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
