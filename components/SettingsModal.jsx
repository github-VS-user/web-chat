import React from 'react';

export default function SettingsModal({
  onClose,
  newUsername,
  setNewUsername,
  handleUsernameChange,
  darkMode,
  setDarkMode,
  messagesSent,
  roomsJoined
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white dark:bg-gray-800 p-6 rounded shadow-lg w-80">
        <h2 className="text-xl font-bold mb-4 text-black dark:text-white">Settings</h2>

        <div className="mb-4">
          <label className="block text-black dark:text-white mb-1">Change Username:</label>
          <input
            type="text"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:text-white"
            placeholder="Enter new username"
          />
          <button
            onClick={handleUsernameChange}
            className="mt-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Change
          </button>
        </div>

        <div className="mb-4">
          <label className="flex items-center text-black dark:text-white">
            <input
              type="checkbox"
              checked={darkMode}
              onChange={() => setDarkMode(!darkMode)}
              className="mr-2"
            />
            Dark Mode
          </label>
        </div>

        <div className="mb-4 text-black dark:text-white">
          <p><strong>Rooms joined:</strong> {roomsJoined.length}</p>
          <ul className="list-disc list-inside text-sm">
            {roomsJoined.map((room, index) => (
              <li key={index}>{room}</li>
            ))}
          </ul>
        </div>

        <div className="mb-4 text-black dark:text-white">
          <p><strong>Messages sent:</strong> {messagesSent}</p>
        </div>

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
