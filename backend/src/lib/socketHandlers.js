import { PassThrough } from 'stream';
import jwt from 'jsonwebtoken';
import docker, { dockerEndpoint } from './docker.js';
import { getGames } from './gameLoader.js';
import { getEffectiveStatuses, getContainerExitInfo, sendStdinCommand } from './containers.js';
import { queryA2S, getPlayers, setPlayers, getPlayerList, setPlayerList } from './playerQuery.js';
import { attachStatsStream, detachStatsStream, computeCpuMem } from './statsStreams.js';
import { sendRconCommand } from './rcon.js';
import { sendCrashNotification, sendEventNotification } from './notifier.js';
import { getHostDiskInfo } from './diskUtils.js';
import { getLogBuffer, pushLogBuffer } from './logBuffer.js';
import { isRevoked } from './tokenRevocation.js';
import {
  getTransient,
  getLastKnown,
  emitStatus,
  emitCrashAlert,
  emitDockerStatus,
  emitDiskStatus,
  emitServerEvent,
  emitPlayers,
  consumeAdminStop,
  clearAdminStop,
} from './statusBus.js';
import logger from './logger.js';

// Player count/list can change without a status transition — compare against
// the cache and only touch it (and broadcast) when something actually moved.
function updatePlayers(id, players) {
  if (getPlayers(id) === players) return;
  setPlayers(id, players);
  emitPlayers(id, players, getPlayerList(id));
}

function updatePlayerList(id, playerList) {
  if (getPlayerList(id) === playerList) return;
  setPlayerList(id, playerList);
  emitPlayers(id, getPlayers(id), playerList);
}

// RCON needs a fresh TCP connection + auth handshake per query (unlike A2S's
// single UDP packet), so the player list is polled less often than status.
const RCON_PLAYERS_EVERY_N_TICKS = 3; // ~15s at the 5s poll interval
const RCON_PLAYER_LIST_MAX_LEN = 2000;

// --- Log level detection ---

function detectLevel(line) {
  if (/\b(ERROR|FATAL)\b|Exception/.test(line)) return 'error';
  if (/\bWARN(?:ING)?\b/.test(line)) return 'warn';
  return 'info';
}

// Docker `timestamps: true` prefixes every line with an RFC3339Nano timestamp
const TS_PREFIX = /^(\d{4}-\d{2}-\d{2}T\S+)\s(.*)$/;

// Streams chunk mid-line; accumulate and only emit completed lines
function makeLineSplitter(onLine) {
  let acc = '';
  return (chunk) => {
    acc += chunk.toString('utf8');
    const lines = acc.split('\n');
    acc = lines.pop();
    for (const line of lines) {
      if (line.trim()) onLine(line);
    }
  };
}

// --- Log stream reference counting ---
// Map<gameId, { raw, refCount }>

const activeLogStreams = new Map();

async function attachLogStream(io, id) {
  const entry = activeLogStreams.get(id);
  if (entry) {
    entry.refCount++;
    return;
  }

  // Reserve the slot before awaiting so concurrent calls increment refCount instead of racing
  const slot = { raw: null, refCount: 1 };
  activeLogStreams.set(id, slot);

  // Lines up to the last buffered timestamp were already delivered (live or via
  // log:history replay) — `since` keeps a re-attach from re-broadcasting them.
  const buf = getLogBuffer(id);
  const lastTs = buf?.length ? buf[buf.length - 1].ts : null;

  let raw;
  try {
    raw = await docker.getContainer(`serverdock-${id}`).logs({
      follow: true,
      stdout: true,
      stderr: true,
      timestamps: true,
      tail: 100,
      ...(lastTs ? { since: (new Date(lastTs).getTime() + 1) / 1000 } : {}),
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

  const handleLine = (rawLine) => {
    const m = TS_PREFIX.exec(rawLine);
    const ts = m ? m[1] : new Date().toISOString();
    const line = m ? m[2] : rawLine;
    if (!line.trim()) return;
    const entry = { ts, line, level: detectLevel(line) };
    pushLogBuffer(id, entry);
    io.to(`logs:${id}`).emit('log:line', { id, ...entry });
  };

  stdout.on('data', makeLineSplitter(handleLine));
  stderr.on('data', makeLineSplitter(handleLine));

  raw.on('end', () => {
    logger.info({ gameId: id }, 'log stream ended');
    io.to(`logs:${id}`).emit('log:end', { id });
    // Only evict if this slot is still the active one — a replaced (leave→join)
    // stream's late 'end' must not delete the slot of the stream that succeeded it.
    if (activeLogStreams.get(id) === slot) activeLogStreams.delete(id);
  });

  raw.on('error', () => {
    if (activeLogStreams.get(id) === slot) activeLogStreams.delete(id);
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

let dockerDown = false;

// Host disk space and per-container resource usage — both checked far less
// often than container status since neither moves fast enough to need 5s
// granularity. 20% free / 90% used mirror the dashboard's own yellow (>80%)
// warning tier, just pushed further out for an actual alert.
const PERIODIC_CHECK_EVERY_N_TICKS = 12; // ~60s at the 5s poll interval
const DISK_LOW_FREE_RATIO = 0.2;
let pollTick = 0;
let diskLow = false;
let lastDiskStatus = { low: false, free: null, total: null };

async function checkDiskSpace() {
  const info = await getHostDiskInfo();
  if (!info || !info.total) return;
  const isLow = info.free / info.total < DISK_LOW_FREE_RATIO;
  lastDiskStatus = { low: isLow, free: info.free, total: info.total };
  if (isLow === diskLow) return;
  diskLow = isLow;
  emitDiskStatus(lastDiskStatus);
  if (isLow) {
    logger.warn({ free: info.free, total: info.total }, 'host disk space low');
    sendEventNotification(
      'Host Disk Space Low',
      `Only ${(info.free / 1e9).toFixed(1)} GB free of ${(info.total / 1e9).toFixed(1)} GB.`
    ).catch(() => {});
  } else {
    logger.info({ free: info.free, total: info.total }, 'host disk space recovered');
  }
}

// Resource usage alerts — requires two consecutive high readings (~2 min
// sustained) before alerting, so a brief spike (e.g. a world autosave) doesn't
// trigger a false alarm. One entry per game id owns both the streak count and
// whether that game is currently in an alerted state.
const RESOURCE_HIGH_PCT = 90;
const RESOURCE_SUSTAINED_CHECKS = 2;
const resourceHighStreak = new Map(); // gameId -> consecutive high-check count
const resourceAlerted = new Set(); // gameId currently alerted

async function checkResourceUsage(game) {
  let raw;
  try {
    raw = await docker.getContainer(`serverdock-${game.id}`).stats({ stream: false });
  } catch {
    return;
  }
  const { cpu, memUsed, memLimit } = computeCpuMem(raw);
  const memPct = memLimit > 0 ? (memUsed / memLimit) * 100 : 0;
  const high = cpu > RESOURCE_HIGH_PCT || memPct > RESOURCE_HIGH_PCT;

  if (!high) {
    resourceHighStreak.delete(game.id);
    if (resourceAlerted.delete(game.id)) {
      logger.info({ gameId: game.id }, 'resource usage recovered');
    }
    return;
  }

  const streak = (resourceHighStreak.get(game.id) ?? 0) + 1;
  resourceHighStreak.set(game.id, streak);
  if (streak < RESOURCE_SUSTAINED_CHECKS || resourceAlerted.has(game.id)) return;

  resourceAlerted.add(game.id);
  const detail =
    cpu > RESOURCE_HIGH_PCT ? `CPU at ${cpu.toFixed(0)}%` : `memory at ${memPct.toFixed(0)}%`;
  logger.warn({ gameId: game.id, cpu, memPct }, 'sustained high resource usage');
  emitServerEvent({ type: 'resource_high', id: game.id, name: game.name, message: detail });
  sendEventNotification('High Resource Usage', `${game.name}: ${detail}.`, game.id).catch(() => {});
}

async function pollStatus(io) {
  // Docker daemon reachability — going silent here would hide every other signal
  try {
    await docker.ping();
    if (dockerDown) {
      dockerDown = false;
      logger.info('docker daemon reachable again');
      emitDockerStatus(true);
    }
  } catch (err) {
    if (!dockerDown) {
      dockerDown = true;
      logger.error(`docker daemon unreachable at ${dockerEndpoint}: ${err.message}`);
      emitDockerStatus(false);
    }
    return;
  }

  pollTick++;
  const periodicCheckDue = pollTick % PERIODIC_CHECK_EVERY_N_TICKS === 0;
  if (periodicCheckDue) {
    checkDiskSpace().catch(() => {});
  }

  const games = getGames();
  const statuses = await getEffectiveStatuses(games.map((g) => g.id));

  if (periodicCheckDue) {
    for (const game of games) {
      if (statuses.get(game.id) === 'running') checkResourceUsage(game).catch(() => {});
    }
  }

  for (const game of games) {
    // An operation (start/pull/stop/…) owns this id right now — don't fight it
    if (getTransient(game.id)) continue;
    try {
      const status = statuses.get(game.id) ?? 'not_created';
      const prev = getLastKnown(game.id);
      // Query player count for running games with A2S configured
      if (status === 'running' && game.query?.type === 'a2s') {
        queryA2S(game.query.port)
          .then((v) => updatePlayers(game.id, v))
          .catch(() => {});
      } else if (status !== 'running') {
        updatePlayers(game.id, null);
      }

      // Live player list via RCON, for games with a configured list command
      // (e.g. "list" on Minecraft) — visibility only, not player management.
      if (
        status === 'running' &&
        game.rcon?.enabled &&
        game.rcon?.listCommand &&
        pollTick % RCON_PLAYERS_EVERY_N_TICKS === 0
      ) {
        sendRconCommand(game, game.rcon.listCommand)
          .then((v) => updatePlayerList(game.id, (v || '').trim().slice(0, RCON_PLAYER_LIST_MAX_LEN)))
          .catch(() => {});
      } else if (status !== 'running') {
        updatePlayerList(game.id, null);
      }

      if (prev !== status) {
        emitStatus(game.id, status);
        logger.info({ gameId: game.id, from: prev ?? 'unknown', to: status }, 'status change');

        // A server that reaches running resets any stale admin-stop intent
        if (status === 'running') clearAdminStop(game.id);

        // Crash detection: an unexpected exit from running, or any entry into the
        // error state (catches servers that die before the poll ever saw them run).
        // prev === undefined is the first sighting after backend boot — show the
        // state but don't alert on stale history.
        const crashed =
          prev !== undefined &&
          ((prev === 'running' &&
            (status === 'stopped' || status === 'not_created' || status === 'error')) ||
            (status === 'error' && prev !== 'error'));
        if (crashed && !consumeAdminStop(game.id)) {
          const exitInfo = await getContainerExitInfo(game.id);
          sendCrashNotification(game, exitInfo).catch(() => {});
          emitCrashAlert({ id: game.id, name: game.name, status, exitInfo });
        }

        // Auto-attach the log stream when a container starts running and someone is watching
        if (status === 'running' && !activeLogStreams.has(game.id)) {
          const room = io.sockets.adapter.rooms.get(`logs:${game.id}`);
          if (room && room.size > 0) {
            attachLogStream(io, game.id).catch(() => {});
          }
        }
      }
    } catch {
      // per-game failure — retried next tick
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
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (isRevoked(decoded.jti)) throw new Error('revoked');
        socket.user = decoded;
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
        // Snapshot only — lastKnown belongs to the poll, so a join right after a
        // crash can't erase the transition before the poll alerts on it.
        const games = getGames();
        const statuses = await getEffectiveStatuses(games.map((g) => g.id));
        const snapshot = games.map((game) => ({
          id: game.id,
          status: statuses.get(game.id) ?? 'not_created',
          players: getPlayers(game.id),
          playerList: getPlayerList(game.id),
        }));
        socket.emit('status:all', snapshot);
        socket.emit('docker:status', { available: !dockerDown });
        socket.emit('disk:status', lastDiskStatus);
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
      // Replay buffered history to this socket only — the live stream may already
      // be attached for another viewer, in which case no tail will be re-fetched.
      const history = getLogBuffer(id);
      if (history?.length) socket.emit('log:history', { id, lines: history });
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

    // Console input — JWT required. Output is observed via the logs room; this
    // only writes to stdin through a short-lived, stdin-only attach.
    socket.on('console:input', async ({ id, input } = {}) => {
      if (!socket.user) return socket.emit('error', { message: 'Authentication required' });
      if (!id || typeof input !== 'string') return;
      try {
        await sendStdinCommand(id, input.slice(0, 1024));
      } catch {
        // container not running / not reachable — caller sees no echo response
      }
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

    // 'disconnecting' — not 'disconnect' — because socket.rooms is already empty
    // by the time 'disconnect' fires, which would leak every attached stream.
    socket.on('disconnecting', () => {
      for (const room of socket.rooms) {
        if (room.startsWith('logs:')) {
          detachLogStream(room.slice(5));
        }
        if (room.startsWith('stats:')) {
          detachStatsStream(room.slice(6));
        }
      }
    });
  });

  // Populate lastDiskStatus immediately so an early join:status doesn't wait
  // out the first periodic check.
  checkDiskSpace().catch(() => {});

  setInterval(() => pollStatus(io), 5_000);
}
