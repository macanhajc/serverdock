import { PassThrough } from 'stream';
import jwt from 'jsonwebtoken';
import docker from './docker.js';
import { getGames } from './gameLoader.js';
import { getContainerStatus } from './containers.js';
import { queryA2S, getPlayers, setPlayers } from './playerQuery.js';
import { attachStatsStream, detachStatsStream } from './statsStreams.js';
import { sendCrashNotification } from './notifier.js';
import logger from './logger.js';

// IDs of containers stopped by admin action — excluded from crash detection
const adminStops = new Set();
export function markAdminStop(id) { adminStops.add(id); }

// eslint-disable-next-line no-control-regex
const stripAnsi = (s) => s.replace(/\x1B\[[0-9;]*[mGKHF]/g, '');

// --- Log level detection ---

function detectLevel(line) {
  if (/\b(ERROR|FATAL)\b|Exception/.test(line)) return 'error';
  if (/\bWARN(?:ING)?\b/.test(line)) return 'warn';
  return 'info';
}

// --- Log stream reference counting ---
// Map<gameId, { raw, refCount }>

const activeLogStreams = new Map();

// --- Console (attach) stream reference counting ---
// Map<gameId, { stream, refCount }>

const activeConsoleStreams = new Map();

async function attachConsoleStream(io, id) {
  const entry = activeConsoleStreams.get(id);
  if (entry) {
    entry.refCount++;
    return;
  }

  const slot = { stream: null, refCount: 1 };
  activeConsoleStreams.set(id, slot);

  let stream;
  try {
    stream = await new Promise((resolve, reject) => {
      docker.getContainer(`serverdock-${id}`).attach(
        { stream: true, stdin: true, stdout: true, stderr: true },
        (err, s) => (err ? reject(err) : resolve(s))
      );
    });
  } catch {
    activeConsoleStreams.delete(id);
    return;
  }

  if (!activeConsoleStreams.has(id)) {
    stream.destroy();
    return;
  }

  slot.stream = stream;
  logger.info({ gameId: id }, 'console stream attached');

  const stdout = new PassThrough();
  const stderr = new PassThrough();
  docker.modem.demuxStream(stream, stdout, stderr);

  const handleData = (chunk) => {
    const lines = chunk.toString('utf8').split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      io.to(`console:${id}`).emit('console:line', { id, line: stripAnsi(line), level: detectLevel(line) });
    }
  };

  stdout.on('data', handleData);
  stderr.on('data', handleData);

  stream.on('end', () => {
    logger.info({ gameId: id }, 'console stream ended');
    io.to(`console:${id}`).emit('console:end', { id });
    activeConsoleStreams.delete(id);
  });

  stream.on('error', () => {
    activeConsoleStreams.delete(id);
  });
}

function detachConsoleStream(id) {
  const entry = activeConsoleStreams.get(id);
  if (!entry) return;
  entry.refCount--;
  if (entry.refCount <= 0) {
    logger.info({ gameId: id }, 'console stream detached');
    if (entry.stream) entry.stream.destroy();
    activeConsoleStreams.delete(id);
  }
}

function sendConsoleInput(id, input) {
  const entry = activeConsoleStreams.get(id);
  if (!entry?.stream) return false;
  try {
    entry.stream.write(`${input}\n`);
    return true;
  } catch {
    return false;
  }
}

async function attachLogStream(io, id) {
  const entry = activeLogStreams.get(id);
  if (entry) {
    entry.refCount++;
    return;
  }

  // Reserve the slot before awaiting so concurrent calls increment refCount instead of racing
  const slot = { raw: null, refCount: 1 };
  activeLogStreams.set(id, slot);

  let raw;
  try {
    raw = await docker.getContainer(`serverdock-${id}`).logs({
      follow: true,
      stdout: true,
      stderr: true,
      tail: 100,
    });
  } catch {
    // Container not running or doesn't exist — slot cleaned up, caller retries on next status transition
    activeLogStreams.delete(id);
    return;
  }

  // Slot may have been evicted by detachLogStream while we were awaiting
  if (!activeLogStreams.has(id)) {
    raw.destroy();
    return;
  }

  slot.raw = raw;
  logger.info({ gameId: id }, 'log stream attached');

  const stdout = new PassThrough();
  const stderr = new PassThrough();
  docker.modem.demuxStream(raw, stdout, stderr);

  const handleData = (chunk) => {
    const lines = chunk.toString('utf8').split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      io.to(`logs:${id}`).emit('log:line', { id, line, level: detectLevel(line) });
    }
  };

  stdout.on('data', handleData);
  stderr.on('data', handleData);

  raw.on('end', () => {
    logger.info({ gameId: id }, 'log stream ended');
    io.to(`logs:${id}`).emit('log:end', { id });
    activeLogStreams.delete(id);
  });

  raw.on('error', () => {
    activeLogStreams.delete(id);
  });
}

function detachLogStream(id) {
  const entry = activeLogStreams.get(id);
  if (!entry) return;
  entry.refCount--;
  if (entry.refCount <= 0) {
    logger.info({ gameId: id }, 'log stream detached');
    if (entry.raw) entry.raw.destroy();
    activeLogStreams.delete(id);
  }
}

// --- Background status poll ---

const lastKnownStatus = new Map();

async function pollStatus(io) {
  for (const game of getGames()) {
    try {
      let status = await getContainerStatus(game.id);
      // If the container exited unexpectedly with an error code but the admin
      // initiated the stop, downgrade to stopped so it doesn't show as crashed.
      if (status === 'error' && adminStops.has(game.id)) status = 'stopped';
      const prev = lastKnownStatus.get(game.id);
      // Query player count for running games with A2S configured
      if (status === 'running' && game.query?.type === 'a2s') {
        queryA2S(game.query.port)
          .then((v) => setPlayers(game.id, v))
          .catch(() => {});
      } else if (status !== 'running') {
        setPlayers(game.id, null);
      }

      if (prev !== status) {
        lastKnownStatus.set(game.id, status);
        io.to('status').emit('status:update', {
          id: game.id,
          status,
          players: getPlayers(game.id),
        });
        logger.info({ gameId: game.id, from: prev ?? 'unknown', to: status }, 'status change');

        // Crash detection: running → stopped/not_created/error not triggered by admin
        if (prev === 'running' && (status === 'stopped' || status === 'not_created' || status === 'error')) {
          if (adminStops.has(game.id)) {
            adminStops.delete(game.id);
          } else {
            sendCrashNotification(game).catch(() => {});
            io.to('status').emit('crash:alert', { id: game.id, name: game.name, status });
          }
        }

        // Auto-attach log stream when a container starts running and someone is watching
        if (status === 'running' && !activeLogStreams.has(game.id)) {
          const room = io.sockets.adapter.rooms.get(`logs:${game.id}`);
          if (room && room.size > 0) {
            attachLogStream(io, game.id).catch(() => {});
          }
        }
      }
    } catch {
      // Docker unavailable — skip
    }
  }
}

// --- Socket setup ---

export function setupSocketHandlers(io) {
  // Verify JWT if provided; allow through without one (public / status-only)
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (token) {
      try {
        socket.user = jwt.verify(token, process.env.JWT_SECRET);
      } catch {
        return next(new Error('Invalid token'));
      }
    }
    next();
  });

  io.on('connection', (socket) => {
    // Status room
    socket.on('join:status', async () => {
      socket.join('status');
      try {
        const snapshot = await Promise.all(
          getGames().map(async (game) => {
            const status = await getContainerStatus(game.id);
            lastKnownStatus.set(game.id, status);
            return { id: game.id, status, players: getPlayers(game.id) };
          })
        );
        socket.emit('status:all', snapshot);
      } catch {
        // Docker unavailable — client will get updates when it recovers
      }
    });

    socket.on('leave:status', () => {
      socket.leave('status');
    });

    // Logs room — JWT required
    socket.on('join:logs', async ({ id } = {}) => {
      if (!socket.user) return socket.emit('error', { message: 'Authentication required' });
      if (!id) return;
      socket.join(`logs:${id}`);
      try {
        await attachLogStream(io, id);
      } catch {
        // container not reachable
      }
    });

    socket.on('leave:logs', ({ id } = {}) => {
      if (!id) return;
      socket.leave(`logs:${id}`);
      detachLogStream(id);
    });

    // Build room — JWT required
    socket.on('join:build', ({ id } = {}) => {
      if (!socket.user) return socket.emit('error', { message: 'Authentication required' });
      if (!id) return;
      socket.join(`build:${id}`);
    });

    socket.on('leave:build', ({ id } = {}) => {
      if (!id) return;
      socket.leave(`build:${id}`);
    });

    // Console room — JWT required; attaches to container stdin/stdout
    socket.on('join:console', async ({ id } = {}) => {
      if (!socket.user) return socket.emit('error', { message: 'Authentication required' });
      if (!id) return;
      socket.join(`console:${id}`);
      try {
        await attachConsoleStream(io, id);
      } catch {
        // container not reachable
      }
    });

    socket.on('leave:console', ({ id } = {}) => {
      if (!id) return;
      socket.leave(`console:${id}`);
      detachConsoleStream(id);
    });

    socket.on('console:input', ({ id, input } = {}) => {
      if (!socket.user) return socket.emit('error', { message: 'Authentication required' });
      if (!id || typeof input !== 'string') return;
      sendConsoleInput(id, input.slice(0, 1024));
    });

    // Stats room — JWT required
    socket.on('join:stats', async ({ id } = {}) => {
      if (!socket.user) return socket.emit('error', { message: 'Authentication required' });
      if (!id) return;
      socket.join(`stats:${id}`);
      try {
        await attachStatsStream(io, id);
      } catch {
        // container not reachable
      }
    });

    socket.on('leave:stats', ({ id } = {}) => {
      if (!id) return;
      socket.leave(`stats:${id}`);
      detachStatsStream(id);
    });

    socket.on('disconnect', () => {
      for (const room of socket.rooms) {
        if (room.startsWith('logs:')) {
          detachLogStream(room.slice(5));
        }
        if (room.startsWith('stats:')) {
          detachStatsStream(room.slice(6));
        }
        if (room.startsWith('console:')) {
          detachConsoleStream(room.slice(8));
        }
      }
    });
  });

  setInterval(() => pollStatus(io), 5_000);
}
