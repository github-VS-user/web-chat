import React, { useState, useEffect, useRef } from 'react';
import socket from './socket';
import { v4 as uuidv4 } from 'uuid';

function App() {
  const [username, setUsername] = useState('');
  const [connected, setConnected] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [wakingUp, setWakingUp] = useState(true);
  const [typingUser, setTypingUser] = useState('');
  const [onlineCount, setOnlineCount] = useState(0);
  const typingTimeoutRef = useRef(null);

  const [room, setRoom] = useState('general');
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [roomMode, setRoomMode] = useState('');
  const [roomInput, setRoomInput] = useState('');
  const [roomError, setRoomError] = useState('');

  const isValidRoomName = (name) => /^[a-zA-Z0-9]{3,8}$/.test(name);

  useEffect(() => {
    const onConnect = () => console.log('Socket connected:', socket.id);
    const onDisconnect = () => console.log('Socket disconnected');

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  // Debug: listen to all socket events
  useEffect(() => {
    socket.onAny((event, ...args) => {
      console.log(`Socket event received: ${event}`, args);
    });
  }, []);

  // Restore username from localStorage on mount
  useEffect(() => {
    const savedName = localStorage.getItem('username');
    if (savedName) {
      setUsername(savedName);
      setConnected(true);
    }
  }, []);

  // Manage socket connect/disconnect, errors, and reconnect attempts
  useEffect(() => {
    const onConnect = () => setWakingUp(false);
    const onDisconnect = () => setWakingUp(true);
    const onConnectError = () => setWakingUp(true);
    const onReconnectAttempt = () => setWakingUp(true);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('reconnect_attempt', onReconnectAttempt);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('reconnect_attempt', onReconnectAttempt);
    };
  }, []);

  useEffect(() => {
    setMessages([]); // Clear old messages immediately when switching rooms
  }, [room]);

  // Register socket event listeners once
  useEffect(() => {
    socket.on('chat message', (msg) => {
      if (msg.room === room) {
        setMessages(prev => [...prev, msg]);
        if (room === 'general') {
          setTimeout(() => {
            setMessages(prev => prev.filter(m => m.id !== msg.id));
          }, 10000);
        }
        const chatEnd = document.getElementById('chat-end');
        if (chatEnd) chatEnd.scrollIntoView({ behavior: 'smooth' });
      }
    });

    socket.on('chat history', (history) => {
      if (history.length > 0 && history[0].room === room) {
        setMessages(history);
      }
    });

    socket.on('user typing', (user) => {
      setTypingUser(user);
    });

    socket.on('user stop typing', () => {
      setTypingUser('');
    });

    socket.on('user joined', (user) => {
      setMessages(prev => [...prev, { id: Date.now(), user: 'System', text: `${user} joined the chat` }]);
    });

    socket.on('user left', (user) => {
      setMessages(prev => [...prev, { id: Date.now(), user: 'System', text: `${user} left the chat` }]);
    });

    socket.on('online users', (count) => {
      setOnlineCount(count);
    });

    socket.on('room created', (roomName) => {
      console.log('[room created] joined room:', roomName);
      setRoom(roomName);
      setShowRoomModal(false);
      setRoomError('');
    });

    // Add joined room listener
    socket.on('joined room', (roomName) => {
      console.log('[joined room] joined room:', roomName);
      setRoom(roomName);
      setShowRoomModal(false);
      setRoomError('');
    });

    socket.on('error message', (msg) => {
      console.log('[error message]', msg);
      setRoomError(msg);
    });

    return () => {
      socket.off('chat message');
      socket.off('chat history');
      socket.off('user typing');
      socket.off('user stop typing');
      socket.off('user joined');
      socket.off('user left');
      socket.off('online users');
      socket.off('room created');
      socket.off('joined room');
      socket.off('error message');
    };
  }, [room]);

  // Emit user joined/left events on username changes and window unload
  useEffect(() => {
    if (username) {
      socket.emit('user joined', { username, room });

      const handleBeforeUnload = () => {
        socket.emit('user left', username);
      };

      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
      };
    }
  }, [username, room]);

  // Handle sending message and showing own message immediately
  const handleSend = () => {
    if (message.trim() === '') return;
    const msgData = {
      id: uuidv4(),
      user: username,
      text: message,
    };
    socket.emit('chat message', { ...msgData, room });
    setMessage('');
  };

  // Handle typing events with throttling
  const handleTyping = (text) => {
    setMessage(text);
    socket.emit('user typing', username);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('user stop typing');
    }, 1000);
  };

  if (wakingUp) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4 text-xl font-semibold">
        <div className="loader"></div>
        <p>Waking up the servers...</p>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100">
        <div className="p-6 bg-white rounded shadow-md">
          <h1 className="text-2xl mb-4">Enter your username</h1>
          <input
            type="text"
            className="border p-2 w-full mb-4"
            onChange={(e) => setUsername(e.target.value)}
            value={username}
            aria-label="Enter username"
          />
          <button
            className="bg-blue-500 text-white px-4 py-2 rounded"
            onClick={() => {
              localStorage.setItem('username', username);
              setConnected(true);
            }}
            disabled={!username.trim()}
          >
            Join Chat
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <header className="bg-blue-600 text-white p-4 flex items-center justify-between text-xl">
        <div className="flex-1">Web Chat</div>

        <div className="flex-1 text-center bg-blue-800 px-3 py-1 rounded text-sm select-none">
          Room: <span className="font-semibold">{room}</span>
        </div>

        <div className="flex-1 flex justify-end">
          <div className="bg-white rounded-full px-3 py-1 flex items-center space-x-2 shadow-lg text-gray-800 text-sm font-medium">
            <span className="w-3 h-3 bg-green-500 rounded-full animate-ping-slow"></span>
            <span>{onlineCount} online</span>
          </div>
        </div>
      </header>

      <div className="px-4 mt-2">
        <button
          className="bg-purple-500 hover:bg-purple-600 text-white px-3 py-1 rounded-full text-sm"
          onClick={() => {
            setShowRoomModal(true);
            setRoomMode('');
            setRoomInput('');
            setRoomError('');
          }}
        >
          Create or Join Group
        </button>
      </div>

      {room !== 'general' && (
        <button
          onClick={() => {
            setRoom('general');
            socket.emit('join room', { username, room: 'general' });
          }}
          className="text-sm text-blue-600 underline mb-2 self-start ml-4"
        >
          ← Back to General
        </button>
      )}

      <div className="fixed top-4 right-4 bg-white rounded-full px-3 py-1 flex items-center space-x-2 shadow-lg">
        <span className="w-3 h-3 bg-green-500 rounded-full animate-ping-slow"></span>
        <span className="text-sm font-medium text-gray-800">{onlineCount} online</span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`p-2 rounded max-w-xs break-words ${
              msg.user === username
                ? 'bg-blue-200 self-end text-right'
                : msg.user === 'System'
                ? 'bg-gray-200 italic text-gray-600 text-center'
                : 'bg-white'
            }`}
          >
            {msg.user !== 'System' && (
              <span className="font-bold">{msg.user}: </span>
            )}
            {msg.text}
          </div>
        ))}
        {typingUser && typingUser !== username && (
          <div className="text-sm text-gray-500 italic">{typingUser} is typing...</div>
        )}
        <div id="chat-end" />
      </div>
      <footer className="p-4 flex bg-white border-t">
        <input
          value={message}
          onChange={(e) => handleTyping(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          className="flex-1 border rounded p-2 mr-2"
          placeholder="Type a message..."
          aria-label="Type your message"
        />
        <button
          onClick={handleSend}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Send
        </button>
      </footer>
      {showRoomModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-md w-80">
            {!roomMode ? (
              <>
                <h2 className="text-lg font-semibold mb-4">Create or Join a Group</h2>
                <div className="flex flex-col gap-2">
                  <button onClick={() => setRoomMode('join')} className="bg-blue-500 text-white px-4 py-2 rounded">Join Group</button>
                  <button onClick={() => setRoomMode('create')} className="bg-green-500 text-white px-4 py-2 rounded">Create Group</button>
                  <button onClick={() => setShowRoomModal(false)} className="mt-2 text-sm text-gray-500 underline">Cancel</button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold mb-4">{roomMode === 'create' ? 'Create' : 'Join'} a Group</h2>
                <input
                  type="text"
                  value={roomInput}
                  onChange={(e) => setRoomInput(e.target.value)}
                  placeholder="Group name (3-8 alphanum)"
                  className="border p-2 w-full mb-2"
                />
                {roomError && <p className="text-red-500 text-sm">{roomError}</p>}
                <div className="flex justify-between">
                  {roomMode === 'create' ? (
                    <button
                      onClick={() => {
                        console.log('Creating room with:', { username, room: roomInput });
                        if (!socket.connected) {
                          console.log('Socket not connected yet, please wait...');
                          setRoomError('Connection not ready. Please try again.');
                          return;
                        }
                        socket.emit('create room', { username, room: roomInput });
                      }}
                      className="bg-green-600 text-white px-4 py-2 rounded"
                    >
                      Create
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        if (!isValidRoomName(roomInput)) {
                          setRoomError('Invalid name: 3-8 letters/numbers only.');
                          return;
                        }
                        socket.emit('join room', { username, room: roomInput });
                      }}
                      className="bg-blue-600 text-white px-4 py-2 rounded"
                    >
                      Join
                    </button>
                  )}
                  <button onClick={() => setShowRoomModal(false)} className="text-sm text-gray-500 underline">Cancel</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
