import { createReadStream } from 'fs';
import { join, extname, basename } from 'path';
import { Router } from 'express';
import { verifyToken } from '../middleware/auth.js';
import { getGames, getGame, GAMES_DIR } from '../lib/gameLoader.js';
import {
  getEffectiveStatus,
  getContainerTimestamps,
  startContainer,
  stopContainer,
  restartContainer,
  resetContainer,
} from '../lib/containers.js';
import { getPlayers, setPlayers } from '../lib/playerQuery.js';
import { getSelfIp } from '../lib/vpn/index.js';
import { getSettings } from '../lib/settingsStore.js';
import { getDirSizeCached } from '../lib/diskUtils.js';
import { getDataPath } from '../lib/gameLoader.js';
import { sendRconCommand } from '../lib/rcon.js';

const router = Router();

async function resolveHost() {
  const vpnIp = await getSelfIp();
  const { serverHost } = getSettings();
  return vpnIp ?? (serverHost?.trim() || null) ?? process.env.SERVER_HOST ?? '127.0.0.1';
}

async function buildServerResponse(game, status) {
  const firstPort = game.ports?.[0];
  const [host, diskUsed, { startedAt, lastActiveAt }] = await Promise.all([
    resolveHost(),
    getDirSizeCached(getDataPath(game.id)),
    getContainerTimestamps(game.id),
  ]);
  return {
    id: game.id,
    name: game.name,
    description: game.description ?? null,
    image: game.image,
    avatarUrl: game.avatar
      ? `/api/servers/${game.id}/avatar?v=${game.avatarVersion ?? 0}`
      : null,
    storeUrl: game.storeUrl ?? null,
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
    lastActiveAt,
    query: game.query ?? null,
    rcon: game.rcon ? { enabled: !!game.rcon.enabled, port: game.rcon.port ?? null } : null,
  };
}

// GET /api/servers — public
router.get('/', async (req, res) => {
  const games = getGames();
  const results = await Promise.all(
    games.map(async (game) => {
      const status = await getEffectiveStatus(game.id);
      return buildServerResponse(game, status);
    })
  );
  res.json(results);
});

// GET /api/servers/:id — public
router.get('/:id', async (req, res) => {
  const game = getGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  const status = await getEffectiveStatus(game.id);
  res.json(await buildServerResponse(game, status));
});

const AVATAR_MIME_BY_EXT = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

// GET /api/servers/:id/avatar — public (cards render it without a JWT)
router.get('/:id/avatar', async (req, res) => {
  const game = getGame(req.params.id);
  if (!game?.avatar) return res.status(404).end();

  const filePath = join(GAMES_DIR, game.id, basename(game.avatar));
  const mime = AVATAR_MIME_BY_EXT[extname(filePath).toLowerCase()];
  res.setHeader('Content-Type', mime ?? 'application/octet-stream');
  // Safe to cache hard — the URL is versioned via ?v=avatarVersion, so a
  // replaced avatar gets a new URL instead of invalidating this one.
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

  const stream = createReadStream(filePath);
  stream.on('error', () => res.status(404).end());
  stream.pipe(res);
});

// POST /api/servers/:id/start — JWT
// startContainer broadcasts every phase (pulling/starting/running) over the
// status room; the held request still reports the final outcome to the caller.
router.post('/:id/start', verifyToken, async (req, res) => {
  const game = getGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  await startContainer(game);
  res.json({ status: 'running' });
});

// POST /api/servers/:id/stop — JWT
router.post('/:id/stop', verifyToken, async (req, res) => {
  const game = getGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  setPlayers(game.id, null); // before the stop so the final emission carries no players
  await stopContainer(game.id);
  res.json({ status: 'stopped' });
});

// POST /api/servers/:id/restart — JWT
router.post('/:id/restart', verifyToken, async (req, res) => {
  const game = getGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  await restartContainer(game.id);
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

  const status = await getEffectiveStatus(game.id);
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
  setPlayers(game.id, null);
  await resetContainer(game.id);
  res.json({ status: 'not_created' });
});

export default router;
