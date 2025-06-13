import { io } from 'socket.io-client';

const socket = io('https://web-chat-dw7f.onrender.com');

export default socket;