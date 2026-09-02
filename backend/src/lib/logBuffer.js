import { getIo } from './socket.js';

// Per-game ring buffer of console output — replayed to sockets joining
// logs:<id> so late viewers see context instead of a blank pane. Lives in its
// own module so both the log stream (socketHandlers.js) and action failures
// (containers.js) can append to the same buffer without a circular import.

const LOG_BUFFER_MAX = 300;
const logBuffers = new Map();

export function getLogBuffer(id) {
  return logBuffers.get(id);
}

export function pushLogBuffer(id, entry) {
  let buf = logBuffers.get(id);
  if (!buf) {
    buf = [];
    logBuffers.set(id, buf);
  }
  buf.push(entry);
  if (buf.length > LOG_BUFFER_MAX) buf.splice(0, buf.length - LOG_BUFFER_MAX);
}

// Injects a synthetic line (e.g. an action failure) into a game's console
// output via the same path real log lines take, so the error is still visible
// in the console after the toast that reported it has dismissed.
export function pushSystemLogLine(id, line, level = 'error') {
  const entry = { ts: new Date().toISOString(), line, level };
  pushLogBuffer(id, entry);
  getIo()?.to(`logs:${id}`).emit('log:line', { id, ...entry });
}
