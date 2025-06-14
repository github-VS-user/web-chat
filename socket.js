import { io } from 'socket.io-client';

const socket = io('server.master3d.net');

export default socket;