import { io } from 'socket.io-client';

// Centralized socket instance — do not create sockets inside components
export const socket = io({ autoConnect: false });

// Authenticated socket for admin use (logs, builds)
// Call socket.auth = { token } then socket.connect() after login
export default socket;
