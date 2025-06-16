

import React from 'react';

export default function Header({ room, onlineUsers, onSettingsClick }) {
  return (
    <header className="bg-blue-600 text-white p-4 flex flex-wrap items-center justify-between text-xl gap-2">
      <div className="flex items-center gap-3">
        <span>💬 Chat App</span>
        <span className="text-sm bg-white text-blue-600 rounded-full px-2 py-1">
          {room ? `Room: ${room}` : 'No room selected'}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm flex items-center gap-1">
          🟢 {onlineUsers.length} online
        </span>
        <button
          onClick={onSettingsClick}
          className="text-white hover:text-gray-300 text-lg"
          title="Settings"
        >
          ⚙️
        </button>
      </div>
    </header>
  );
}