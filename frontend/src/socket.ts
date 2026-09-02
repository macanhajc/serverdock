import { io } from 'socket.io-client';

// Centralized socket instance — do not create sockets inside components.
// Used unauthenticated by the public dashboard (status room only) and
// authenticated by the admin panel (logs, builds, stats) — call
// socket.auth = { token } then socket.connect() after login.
export const socket = io({ autoConnect: false });

export default socket;
