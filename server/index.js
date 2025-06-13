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

io.on('connection', (socket) => {
  console.log(`User connected: socket id = ${socket.id}`);

  socket.onAny((event, ...args) => {
    console.log(`Received event: "${event}" with args:`, args);
  });

  socket.join('general');
  console.log(`Socket ${socket.id} joined room "general"`);

  Message.find({ room: 'general' }).sort({ timestamp: -1 }).limit(50)
    .then(messages => {
      console.log(`Sending chat history to socket ${socket.id} for room "general" with ${messages.length} messages`);
      socket.emit('chat history', messages.reverse());
    }).catch(err => console.error('Failed to fetch message history:', err));

  const count = (usersPerRoom.get('general') || 0) + 1;
  usersPerRoom.set('general', count);
  io.to('general').emit('online users', count);
  console.log(`Online users in "general" updated to ${count}`);

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

    Array.from(socket.rooms).forEach(r => {
      if (r !== socket.id && r !== room) {
        socket.leave(r);
        const users = usersPerRoom.get(r) || 1;
        usersPerRoom.set(r, users - 1);
        io.to(r).emit('online users', usersPerRoom.get(r));
        io.to(r).emit('user left', username);
        console.log(`User ${username} left room "${r}"`);
      }
    });

    socket.join(room);
    console.log(`User ${username} joined room "${room}"`);

    Message.find({ room }).sort({ timestamp: -1 }).limit(50).then(messages => {
      console.log(`Sending chat history to socket ${socket.id} for room "${room}" with ${messages.length} messages`);
      socket.emit('chat history', messages.reverse());
    }).catch(err => console.error('Failed to fetch message history:', err));

    const count = (usersPerRoom.get(room) || 0) + 1;
    usersPerRoom.set(room, count);

    io.to(room).emit('online users', count);
    io.to(room).emit('user joined', username);
    console.log(`Online users in "${room}" updated to ${count}`);
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

    Array.from(socket.rooms).forEach(r => {
      if (r !== socket.id) {
        console.log(`[CREATE ROOM] User "${username}" leaving room "${r}"`);
        socket.leave(r);
      }
    });

    rooms.add(room);
    socket.join(room);
    console.log(`[CREATE ROOM] User "${username}" joined new room "${room}"`);

    const count = (usersPerRoom.get(room) || 0) + 1;
    usersPerRoom.set(room, count);

    io.to(room).emit('online users', count);
    io.to(room).emit('user joined', username);
    socket.emit('room created', room);
    console.log(`[CREATE ROOM] Room "${room}" creation complete and notification sent`);
  });

  socket.on('chat message', (msg) => {
    if (!msg.room || !rooms.has(msg.room)) {
      console.log(`Ignoring chat message for invalid room: ${msg.room}`);
      return;
    }
    console.log(`Received chat message in room "${msg.room}" from user "${msg.user}": ${msg.text}`);

    const { room, user, text } = msg;
    const messageDoc = new Message({ room, user, text });
    messageDoc.save()
      .then(() => console.log('Message saved to MongoDB'))
      .catch(err => console.error('Failed to save message:', err));

    io.to(msg.room).emit('chat message', msg);
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: socket id = ${socket.id}`);
    socket.rooms.forEach(r => {
      if (r !== socket.id) {
        const users = usersPerRoom.get(r) || 1;
        usersPerRoom.set(r, users - 1);
        io.to(r).emit('online users', usersPerRoom.get(r));
        io.to(r).emit('user left', 'A user');
        console.log(`User left room "${r}" due to disconnect`);
      }
    });
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
