import { Router } from 'express';
import { verifyToken } from '../middleware/auth.js';
import { getGames, getGame } from '../lib/gameLoader.js';
import {
  getContainerStatus,
  getContainerStartedAt,
  startContainer,
  stopContainer,
  restartContainer,
  resetContainer,
} from '../lib/containers.js';
import { getIo } from '../lib/socket.js';
import { getPlayers, setPlayers } from '../lib/playerQuery.js';
import { getSelfIp } from '../lib/vpn/index.js';
import { getSettings } from '../lib/settingsStore.js';
import { getDirSize } from '../lib/diskUtils.js';
import { getDataPath } from '../lib/gameLoader.js';
import { markAdminStop } from '../lib/socketHandlers.js';
import { sendRconCommand } from '../lib/rcon.js';

function emitStatusUpdate(id, status) {
  getIo()
    ?.to('status')
    .emit('status:update', { id, status, players: getPlayers(id) });
}

const router = Router();

async function resolveHost() {
  const vpnIp = await getSelfIp();
  const { serverHost } = getSettings();
  return vpnIp ?? (serverHost?.trim() || null) ?? process.env.SERVER_HOST ?? '127.0.0.1';
}

async function buildServerResponse(game, status) {
  const firstPort = game.ports?.[0];
  const [host, diskUsed, startedAt] = await Promise.all([
    resolveHost(),
    getDirSize(getDataPath(game.id)),
    getContainerStartedAt(game.id),
  ]);
  return {
    id: game.id,
    name: game.name,
    description: game.description ?? null,
    image: game.image,
    status,
    players: getPlayers(game.id),
    connection: {
      host,
      port: firstPort?.host ?? null,
      protocol: firstPort?.protocol ?? null,
    },
    imageSource: game.imageSource,
    imageBuilt: game.imageSource === 'local' ? (game.imageBuilt ?? false) : null,
    ports: game.ports ?? [],
    cpuLimit: game.cpuLimit ?? null,
    memoryLimit: game.memoryLimit ?? null,
    dataMount: game.dataMount ?? '/data',
    pinnedEnv: (game.environment ?? [])
      .filter((e) => e.pinned && e.key)
      .map((e) => ({ key: e.key, value: e.value })),
    diskUsed,
    startedAt,
    query: game.query ?? null,
    rcon: game.rcon ? { enabled: !!game.rcon.enabled, port: game.rcon.port ?? null } : null,
  };
}

// GET /api/servers — public
router.get('/', async (req, res) => {
  const games = getGames();
  const results = await Promise.all(
    games.map(async (game) => {
      const status = await getContainerStatus(game.id);
      return buildServerResponse(game, status);
    })
  );
  res.json(results);
});

// GET /api/servers/:id — public
router.get('/:id', async (req, res) => {
  const game = getGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  const status = await getContainerStatus(game.id);
  res.json(await buildServerResponse(game, status));
});

// POST /api/servers/:id/start — JWT
router.post('/:id/start', verifyToken, async (req, res) => {
  const game = getGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  await startContainer(game);
  emitStatusUpdate(game.id, 'running');
  res.json({ status: 'running' });
});

// POST /api/servers/:id/stop — JWT
router.post('/:id/stop', verifyToken, async (req, res) => {
  const game = getGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  markAdminStop(game.id);
  await stopContainer(game.id);
  setPlayers(game.id, null);
  emitStatusUpdate(game.id, 'stopped');
  res.json({ status: 'stopped' });
});

// POST /api/servers/:id/restart — JWT
router.post('/:id/restart', verifyToken, async (req, res) => {
  const game = getGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  await restartContainer(game.id);
  emitStatusUpdate(game.id, 'running');
  res.json({ status: 'running' });
});

// POST /api/servers/:id/rcon — JWT
router.post('/:id/rcon', verifyToken, async (req, res) => {
  const game = getGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  if (!game.rcon?.enabled) return res.status(400).json({ error: 'RCON is not enabled for this game' });

  const { command } = req.body ?? {};
  if (!command || typeof command !== 'string' || !command.trim()) {
    return res.status(400).json({ error: 'Command is required' });
  }

  const status = await getContainerStatus(game.id);
  if (status !== 'running') return res.status(409).json({ error: 'Server is not running' });

  try {
    const response = await sendRconCommand(game, command.trim().slice(0, 1024));
    res.json({ response: response || '(no response)' });
  } catch {
    res.status(503).json({ error: 'RCON connection failed — check that RCON is enabled in the game config' });
  }
});

// POST /api/servers/:id/reset — JWT
router.post('/:id/reset', verifyToken, async (req, res) => {
  if (req.body?.confirm !== true) {
    return res.status(400).json({ error: 'Reset not confirmed' });
  }
  const game = getGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  markAdminStop(game.id);
  await resetContainer(game.id);
  setPlayers(game.id, null);
  emitStatusUpdate(game.id, 'not_created');
  res.json({ status: 'not_created' });
});

export default router;
