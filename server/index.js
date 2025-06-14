import multer from 'multer';
import { createClient } from 'webdav';
import path from 'path';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const rooms = new Set(['general']);

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('Connected to MongoDB');
  Room.find().then(docs => {
    docs.forEach(doc => rooms.add(doc.name));
    console.log(`Restored ${docs.length} room(s) from MongoDB`);
  }).catch(err => {
    console.error('Failed to restore rooms:', err);
  });
}).catch((err) => {
  console.error('MongoDB connection error:', err);
});

const messageSchema = new mongoose.Schema({
  _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
  room: String,
  user: String,
  text: String,
  timestamp: { type: Date, default: Date.now },
});

const Message = mongoose.model('Message', messageSchema);

const roomSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now },
});
const Room = mongoose.model('Room', roomSchema);

import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
const upload = multer({ limits: { fileSize: 20 * 1024 * 1024 } }); // 20MB max
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // Allow all origins; you can restrict this in production
  },
});

app.use(cors());

const webdavClient = createClient(
  "https://webdav.icedrive.net/",
  {
    username: process.env.ICEDRIVE_EMAIL,
    password: process.env.ICEDRIVE_KEY,
  }
);

app.get('/', (req, res) => {
  res.send('Server is awake!');
});


const usersPerRoom = new Map();
const connectedSockets = new Set();
const kickedUsers = new Set();

app.post('/upload', upload.single('file'), async (req, res) => {
  console.log('UPLOAD DEBUG:', {
    body: req.body,
    hasFile: !!req.file
  });
  try {
    const { username, room } = req.body;
    if (!username || !room || room === 'general') {
      return res.status(400).json({ error: 'Invalid upload parameters' });
    }

    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const remotePath = path.posix.join('rooms', room, `${Date.now()}_${file.originalname}`);

    await webdavClient.putFileContents(remotePath, file.buffer);

    const fileUrl = `https://webdav.icedrive.io/remote.php/dav/files/${process.env.ICEDRIVE_EMAIL}/${remotePath}`;

    // Save file metadata to MongoDB
    const fileMessage = new Message({
      room,
      user: username.toLowerCase(),
      text: `📎 Shared a file: ${fileUrl}`,
    });

    await fileMessage.save();

    // Emit to room about the file upload
    io.to(room).emit('chat message', {
      room,
      user: username.toLowerCase(),
      text: `📎 Shared a file: ${fileUrl}`,
    });

    res.json({ success: true, fileUrl });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

io.on('connection', (socket) => {
  console.log(`User connected: socket id = ${socket.id}`);

  // Track this socket as connected
  connectedSockets.add(socket.id);

  socket.onAny((event, ...args) => {
    console.log(`Received event: "${event}" with args:`, args);
  });

  // Do NOT join general room by default.
  // Require client to emit 'join room' or 'create room' with username and room.

  // Helper to update user lists for all rooms this socket is in
  const updateUsersCountForRooms = () => {
    socket.rooms.forEach(room => {
      if (room === socket.id) return; // skip socket's private room
      const clients = io.sockets.adapter.rooms.get(room);
      let usersInRoom = [];
      if (clients) {
        usersInRoom = Array.from(clients)
          .map(socketId => {
            const s = io.sockets.sockets.get(socketId);
            return s?.data?.username;
          })
          .filter(Boolean); // only sockets with assigned usernames
      }
      usersPerRoom.set(room, usersInRoom.length);
      io.to(room).emit('online users', usersInRoom);
      console.log(`Online users in "${room}" updated to ${usersInRoom.length}`);
    });
  };


  // No updateUsersCountForRooms here; user must join a room first.

  socket.on('test-event', (data) => {
    console.log(`Received test-event from ${socket.id} with data:`, data);
    socket.emit('test-event-response', 'pong');
  });

  socket.on('join room', ({ username, room }) => {
    username = username.toLowerCase();
    console.log(`User ${username} requested to join room "${room}"`);

    if (!rooms.has(room)) {
      console.log(`Room "${room}" does not exist`);
      socket.emit('error message', `Room "${room}" does not exist.`);
      return;
    }

    if (kickedUsers.has(username)) {
      console.log(`User "${username}" is kicked and cannot join room "${room}".`);
      socket.emit('kicked');
      return;
    }

    socket.data.username = username;

    socket.join(room);
    console.log(`User ${username} joined room "${room}"`);

    // Leave previous rooms except private socket room and new room
    const previousRooms = Array.from(socket.rooms).filter(r => r !== socket.id && r !== room);
    previousRooms.forEach(r => {
      socket.leave(r);
      io.to(r).emit('user left', username);
      console.log(`User ${username} left room "${r}"`);
    });

    socket.emit('joined room', room);

    Message.find({ room }).sort({ timestamp: -1 }).limit(50)
      .then(messages => {
        console.log(`Sending chat history to socket ${socket.id} for room "${room}" with ${messages.length} messages`);
        socket.emit('chat history', messages.reverse());
      }).catch(err => console.error('Failed to fetch message history:', err));

    updateUsersCountForRooms();

    io.to(room).emit('user joined', username);
  });

  socket.on('create room', ({ username, room }) => {
    username = username.toLowerCase();
    console.log(`[CREATE ROOM] User "${username}" requested to create room "${room}"`);

    if (!/^[a-zA-Z0-9]{3,8}$/.test(room)) {
      console.log(`[CREATE ROOM] Invalid room name: "${room}"`);
      socket.emit('error message', 'Room name must be 3-8 letters/numbers only.');
      return;
    }

    if (rooms.has(room)) {
      console.log(`[CREATE ROOM] Room "${room}" already exists.`);
      socket.emit('error message', `Room "${room}" already exists.`);
      return;
    }

    if (kickedUsers.has(username)) {
      console.log(`User "${username}" is kicked and cannot join room "${room}".`);
      socket.emit('kicked');
      return;
    }

    // Leave all rooms except private room
    Array.from(socket.rooms).forEach(r => {
      if (r !== socket.id) {
        console.log(`[CREATE ROOM] User "${username}" leaving room "${r}"`);
        socket.leave(r);
      }
    });

    rooms.add(room);
    Room.create({ name: room }).then(() => {
      console.log(`Room "${room}" saved to MongoDB`);
    }).catch(err => {
      console.error('Failed to save room:', err);
    });
    socket.join(room);
    socket.emit('joined room', room);
    socket.data.username = username;
    console.log(`[CREATE ROOM] User "${username}" joined new room "${room}"`);

    updateUsersCountForRooms();

    io.to(room).emit('user joined', username);
    socket.emit('room created', room);
  });
  // Admin/command events
  socket.on('command', ({ command, room, username }) => {
    username = username.toLowerCase();
    if (!room || !rooms.has(room)) return;

    if (command === '/clear') {
      if (room === 'general') {
        io.to(room).emit('clear messages');
        console.log(`Cleared messages in general room (frontend-only).`);
      } else {
        Message.deleteMany({ room })
          .then(() => {
            io.to(room).emit('clear messages');
            console.log(`Cleared messages in MongoDB for room "${room}".`);
          })
          .catch(err => console.error('Failed to clear messages:', err));
      }
    }

    if (command.startsWith('/kick ')) {
      const target = command.split(' ')[1]?.toLowerCase();
      if (target) {
        kickedUsers.add(target);
        for (const [id, s] of io.of('/').sockets) {
          if ((s.data?.username || '').toLowerCase() === target) {
            s.emit('kicked');
            s.leave(room);
            s.disconnect(true);
            console.log(`User "${target}" was kicked from room "${room}" and disconnected.`);
          }
        }
      }
    }

    if (command.startsWith('/unkick ')) {
      const target = command.split(' ')[1]?.toLowerCase();
      if (target && kickedUsers.has(target)) {
        kickedUsers.delete(target);
        console.log(`User "${target}" was un-kicked.`);
      }
    }
  });

  socket.on('chat message', (msg) => {
    if (!msg.room || !rooms.has(msg.room)) {
      console.log(`Ignoring chat message for invalid room: ${msg.room}`);
      return;
    }
    const { room, text } = msg;
    const user = msg.user.toLowerCase();
    console.log(`Received chat message in room "${room}" from user "${user}": ${text}`);

    if (room === 'general') {
      console.log('Skipping saving message from general room.');
    } else {
      const messageDoc = new Message({ room, user, text });
      messageDoc.save()
        .then(() => console.log('Message saved to MongoDB'))
        .catch(err => console.error('Failed to save message:', err));
    }

    io.to(room).emit('chat message', { room, user, text });
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: socket id = ${socket.id}`);

    // Remove from connected sockets
    connectedSockets.delete(socket.id);

    updateUsersCountForRooms();

    // You may need to track username in socket.data.username on join
    const username = (socket.data?.username || 'A user').toLowerCase();

    socket.rooms.forEach(r => {
      if (r !== socket.id) {
        io.to(r).emit('user left', username);
        console.log(`User ${username} left room "${r}" due to disconnect`);
      }
    });
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
