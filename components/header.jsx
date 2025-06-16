import React from 'react';

export default function Header({ room, onlineUsers, onSettingsClick }) {
  console.log("Header received room:", room);
  return (
    <header className="bg-blue-600 text-white p-2 flex flex-col md:flex-row md:items-center md:justify-between gap-2 text-base">
      <div className="flex items-center justify-between w-full md:w-auto gap-3">
        <span className="text-2xl">💬 Chat App</span>
      </div>
      <div className="text-center w-full md:w-auto">
        <span className="text-sm bg-white text-blue-600 rounded-full px-4 py-1">
          {typeof room === 'string' && room.trim() !== '' ? `Room: ${room}` : 'Room: general'}
        </span>
      </div>
      <div className="flex items-center justify-between w-full md:w-auto gap-3 md:justify-end">
        <span className="text-sm flex items-center gap-1">
          🟢 {onlineUsers?.length ?? 0} online
        </span>
      </div>
    </header>
  );
}