import React, { useState, useEffect, useRef } from 'react';
import socket from './socket';
import { v4 as uuidv4 } from 'uuid';
import { Filter } from 'bad-words';
const filter = new Filter();
import Header from './components/header.jsx';
import ChatWindow from './components/ChatWindow.jsx';
import SettingsModal from './components/SettingsModal.jsx';

function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [username, setUsername] = useState('');
  const [connected, setConnected] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [wakingUp, setWakingUp] = useState(true);
  const [typingUser, setTypingUser] = useState('');
  const [onlineUsers, setOnlineUsers] = useState([]);
  const typingTimeoutRef = useRef(null);
  const [timeoutReached, setTimeoutReached] = useState(false);
  useEffect(() => {
    if (wakingUp) {
      const timer = setTimeout(() => {
        setTimeoutReached(true);
      }, 20000); // 25 seconds

      return () => clearTimeout(timer);
    } else {
      setTimeoutReached(false);
    }
  }, [wakingUp]);

  const handleRetry = () => {
    setTimeoutReached(false);
    setWakingUp(true);
    if (socket.connected) {
      socket.disconnect();
    }
    socket.connect();
  };

  const handleContactAdmin = () => {
    window.location.href = '/admin.html';
  };

  const [room, setRoom] = useState('general');
  const roomRef = useRef(room);
  useEffect(() => {
    roomRef.current = room;
  }, [room]);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [roomMode, setRoomMode] = useState('');
  const [roomInput, setRoomInput] = useState('');
  const [roomError, setRoomError] = useState('');
  const [kicked, setKicked] = useState(false);

  const [commandValid, setCommandValid] = useState(null);
  const [targetValid, setTargetValid] = useState(null);

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

  useEffect(() => {
    socket.onAny((event, ...args) => {
      console.log(`Socket event received: ${event}`, args);
    });
  }, []);

  useEffect(() => {
    const savedName = localStorage.getItem('username');
    const lowerName = savedName?.toLowerCase();

    const handleConnect = () => {
      if (lowerName) {
        setUsername(lowerName);
        setConnected(true);
        socket.emit('join room', { username: lowerName, room: 'general' });
      }
    };

    socket.on('connect', handleConnect);
    return () => socket.off('connect', handleConnect);
  }, []);

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
    setMessages([]);
  }, [room]);

  useEffect(() => {
    socket.on('chat message', (msg) => {
      if (msg.room === roomRef.current) {
        setMessages(prev => [...prev, msg]);
        if (roomRef.current === 'general') {
          setTimeout(() => {
            setMessages(prev => prev.filter(m => m.id !== msg.id));
          }, 10000);
        }
        const chatEnd = document.getElementById('chat-end');
        if (chatEnd) chatEnd.scrollIntoView({ behavior: 'smooth' });
      }
    });

    socket.on('chat history', (history) => {
      if (history.length > 0 && history[0].room === roomRef.current) {
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
      setMessages(prev => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          user: 'System',
          text: `${user} joined the chat`
        }
      ]);
    });

    socket.on('user left', (user) => {
      setMessages(prev => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          user: 'System',
          text: `${user} left the chat`
        }
      ]);
    });

    socket.on('online users', (userList) => {
      console.log('Received online users:', userList);
      setOnlineUsers(Array.isArray(userList) ? userList : []);
    });

    socket.on('room created', (roomName) => {
      console.log('[room created] joined room:', roomName);
      setRoom(roomName);
      setShowRoomModal(false);
      setRoomError('');
    });

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

    socket.on('kicked', () => {
      setKicked(true);
    });

    socket.on('clear messages', () => {
      setMessages([]);
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
      socket.off('kicked');
      socket.off('clear messages');
    };
  }, [room]);

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

  const handleSend = () => {
    if (message.trim() === '') return;

    if (message.startsWith('/')) {
      socket.emit('command', {
        command: message,
        room,
        username,
      });
    } else {
      const cleanedMessage = filter.clean(message);

      const msgData = {
        id: uuidv4(),
        user: username,
        text: cleanedMessage,
      };
      socket.emit('chat message', { ...msgData, room });
    }
    setMessage('');
  };

  const handleTyping = (text) => {
    setMessage(text);
    socket.emit('user typing', username);

    if (text.startsWith('/')) {
      const parts = text.trim().split(' ');
      const base = parts[0];
      const target = parts[1]?.toLowerCase();

      const validCommands = ['/clear', '/kick', '/unkick'];
      setCommandValid(validCommands.includes(base));

      if (base === '/kick' && target) {
        setTargetValid(onlineUsers.includes(target));
      } else {
        setTargetValid(null);
      }
    } else {
      setCommandValid(null);
      setTargetValid(null);
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setTypingUser('');
      socket.emit('user stop typing');
    }, 1500);
  };

  console.log('Online users count at render:', onlineUsers?.length ?? 0);

  if (kicked) {
    return (
      <div className="h-screen flex items-center justify-center bg-red-50 text-red-700 text-xl font-semibold border-4 border-red-500">
        <div className="text-center space-y-4">
          <div className="text-6xl">🚫</div>
          <p>You have been kicked from this chat room.</p>
          <p>Please contact the admin or refresh later.</p>
        </div>
      </div>
    );
  }

  if (timeoutReached) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4 text-xl font-semibold p-4 text-center">
        <div className="text-6xl">😵‍💫</div>
        <p>Oops, our servers are having a bad day...</p>
        <div className="flex gap-4 mt-4">
          <button
            onClick={handleRetry}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            aria-label="Retry connecting to server"
          >
            Retry
          </button>
          <button
            onClick={handleContactAdmin}
            className="bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400"
            aria-label="Contact admin"
          >
            Contact Admin
          </button>
        </div>
      </div>
    );
  } else if (wakingUp) {
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
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
            value={username}
            aria-label="Enter username"
          />
          <button
            className="bg-blue-500 text-white px-4 py-2 rounded"
            onClick={() => {
              localStorage.setItem('username', username.toLowerCase());
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
    <div className={`h-screen flex flex-col overflow-hidden sm:overflow-auto ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-100 text-black'}`}>
      <Header />
      <div className="w-full text-right pr-4 mt-1">
        <button
          onClick={() => setShowSettings(true)}
          className="text-gray-700 hover:text-gray-900 text-xl"
          aria-label="Settings"
        >
          ⚙️
        </button>
      </div>
      <div className="px-4 mt-2">
        <button
          className="bg-purple-500 hover:bg-purple-600 text-white px-3 py-1 rounded-full text-sm sm:text-base"
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
      <ChatWindow
        username={username}
        messages={messages}
        typingUser={typingUser}
        onlineUsers={onlineUsers}
        room={room}
        setRoom={setRoom}
        setShowRoomModal={setShowRoomModal}
        socket={socket}
      />
      <footer className="p-4 flex bg-white border-t items-center space-x-2">
        <input
          value={message}
          onChange={(e) => handleTyping(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          className={`flex-1 border rounded p-2 min-w-0 ${
            commandValid === false || targetValid === false
              ? 'border-red-500'
              : commandValid === true || targetValid === true
              ? 'border-green-500'
              : ''
          }`}
          placeholder="Type a message..."
          aria-label="Type your message"
        />
        {room !== 'general' && (
          <>
            <label
              htmlFor="file-upload"
              className="cursor-pointer bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm sm:text-base select-none"
              title="Upload File"
              aria-label="Upload File"
            >
              📎
            </label>
            <input
              id="file-upload"
              type="file"
              accept=".pdf,.jpg,.png,.txt,.zip,.mp4,.docx"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files[0];
                if (!file) return;

                if (file.size > 20 * 1024 * 1024) {
                  alert('File size exceeds 20 MB limit.');
                  e.target.value = '';
                  return;
                }

                const formData = new FormData();
                formData.append('file', file);
                formData.append('username', username);
                formData.append('room', room);

                try {
                  const response = await fetch('https://server.master3d.net/upload', {
                    method: 'POST',
                    body: formData,
                  });

                  if (!response.ok) {
                    throw new Error(`Server responded with status ${response.status}`);
                  }
                  let data;
                  try {
                    data = await response.json();
                  } catch (jsonErr) {
                    throw new Error('Failed to parse server response as JSON.');
                  }
                  console.log('[upload response]', data);
                  if (data.success) {
                    socket.emit('chat message', {
                      id: uuidv4(),
                      user: username,
                      text: `📎 Shared a file: ${data.fileUrl}`,
                      room,
                    });
                    console.log('File uploaded successfully!');
                  } else {
                    alert('Upload failed: ' + data.error);
                  }
                } catch (err) {
                  alert('Error uploading file.');
                  console.error(err);
                }

                e.target.value = '';
              }}
            />
          </>
        )}
        <button
          onClick={handleSend}
          className="bg-blue-500 text-white px-4 py-2 rounded text-sm sm:text-base"
        >
          Send
        </button>
      </footer>
      {showRoomModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          role="dialog" aria-modal="true" aria-labelledby="modal-title"
        >
          <div className="bg-white p-6 rounded shadow-md w-80">
            {!roomMode ? (
              <>
                <h2 id="modal-title" className="text-lg font-semibold mb-4">Create or Join a Group</h2>
                <div className="flex flex-col gap-2">
                  <button onClick={() => setRoomMode('join')} aria-label="Join Group" className="bg-blue-500 text-white px-4 py-2 rounded text-sm sm:text-base">Join Group</button>
                  <button onClick={() => setRoomMode('create')} aria-label="Create Group" className="bg-green-500 text-white px-4 py-2 rounded text-sm sm:text-base">Create Group</button>
                  <button onClick={() => setShowRoomModal(false)} aria-label="Cancel" className="mt-2 text-sm text-gray-500 underline">Cancel</button>
                </div>
              </>
            ) : (
              <>
                <h2 id="modal-title" className="text-lg font-semibold mb-4">{roomMode === 'create' ? 'Create' : 'Join'} a Group</h2>
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
                        const trimmedRoom = roomInput.trim();
                        console.log('Creating room with:', { username, room: trimmedRoom });
                        if (!socket.connected) {
                          console.log('Socket not connected yet, please wait...');
                          setRoomError('Connection not ready. Please try again.');
                          return;
                        }
                        socket.emit('create room', { username, room: trimmedRoom });
                      }}
                      className="bg-green-600 text-white px-4 py-2 rounded text-sm sm:text-base"
                    >
                      Create
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        const trimmedRoom = roomInput.trim();
                        if (!isValidRoomName(trimmedRoom)) {
                          setRoomError('Invalid name: 3-8 letters/numbers only.');
                          return;
                        }
                        socket.emit('join room', { username, room: trimmedRoom });
                      }}
                      className="bg-blue-600 text-white px-4 py-2 rounded text-sm sm:text-base"
                    >
                      Join
                    </button>
                  )}
                  <button onClick={() => setShowRoomModal(false)} aria-label="Cancel" className="text-sm text-gray-500 underline">Cancel</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {showSettings && (
        <SettingsModal
          show={showSettings}
          onClose={() => setShowSettings(false)}
          username={username}
          setUsername={setUsername}
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          onlineUsers={onlineUsers}
        />
      )}
    </div>
  );
}

export default App;
