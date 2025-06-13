import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const rooms = new Set(['general']);

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('Connected to MongoDB');
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

import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // Allow all origins; you can restrict this in production
  },
});

app.use(cors());

app.get('/', (req, res) => {
  res.send('Server is awake!');
});


const usersPerRoom = new Map();
const connectedSockets = new Set();
const kickedUsers = new Set();

io.on('connection', (socket) => {
  console.log(`User connected: socket id = ${socket.id}`);

  // Track this socket as connected
  connectedSockets.add(socket.id);

  socket.onAny((event, ...args) => {
    console.log(`Received event: "${event}" with args:`, args);
  });

  // Join general room by default
  socket.join('general');
  console.log(`Socket ${socket.id} joined room "general"`);

  // Helper to update user counts for all rooms this socket is in
  const updateUsersCountForRooms = () => {
    socket.rooms.forEach(room => {
      if (room === socket.id) return; // skip socket's private room
      // Count how many connected sockets are in this room
      const clients = io.sockets.adapter.rooms.get(room);
      const count = clients ? clients.size : 0;
      usersPerRoom.set(room, count);
      io.to(room).emit('online users', count);
      console.log(`Online users in "${room}" updated to ${count}`);
    });
  };


  // Update counts for initial rooms
  updateUsersCountForRooms();

  socket.on('test-event', (data) => {
    console.log(`Received test-event from ${socket.id} with data:`, data);
    socket.emit('test-event-response', 'pong');
  });

  socket.on('join room', ({ username, room }) => {
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
      const target = command.split(' ')[1];
      if (target) {
        kickedUsers.add(target);
        for (const [id, s] of io.of('/').sockets) {
          if (s.data?.username === target) {
            s.emit('kicked');
            s.leave(room);
            console.log(`User "${target}" was kicked from room "${room}".`);
          }
        }
      }
    }

    if (command.startsWith('/unkick ')) {
      const target = command.split(' ')[1];
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
    console.log(`Received chat message in room "${msg.room}" from user "${msg.user}": ${msg.text}`);

    const { room, user, text } = msg;

    if (room === 'general') {
      console.log('Skipping saving message from general room.');
    } else {
      const messageDoc = new Message({ room, user, text });
      messageDoc.save()
        .then(() => console.log('Message saved to MongoDB'))
        .catch(err => console.error('Failed to save message:', err));
    }

    io.to(msg.room).emit('chat message', msg);
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: socket id = ${socket.id}`);

    // Remove from connected sockets
    connectedSockets.delete(socket.id);

    updateUsersCountForRooms();

    // You may need to track username in socket.data.username on join
    const username = socket.data?.username || 'A user';

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
