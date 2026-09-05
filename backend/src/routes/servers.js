import { createReadStream } from 'fs';
import { join, extname, basename } from 'path';
import { Router } from 'express';
import { verifyToken } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permissions.js';
import { getGames, getGame, GAMES_DIR } from '../lib/gameLoader.js';
import {
  getEffectiveStatus,
  getEffectiveStatuses,
  getContainerTimestamps,
  startContainer,
  stopContainer,
  restartContainer,
  resetContainer,
} from '../lib/containers.js';
import { getPlayers, setPlayers, getPlayerList, setPlayerList } from '../lib/playerQuery.js';
import { getResourceAlert, clearResourceAlert } from '../lib/resourceAlerts.js';
import { getLastCrash, clearLastCrash } from '../lib/crashInfo.js';
import { getActionFailure, clearActionFailure } from '../lib/actionFailures.js';
import { listEvents, clearEvents } from '../lib/eventLog.js';
import { emitResourceAlert, emitCrashUpdate, emitActionFailure } from '../lib/statusBus.js';
import { getSelfIp } from '../lib/vpn/index.js';
import { getSettings } from '../lib/settingsStore.js';
import { getDirSizeCached } from '../lib/diskUtils.js';
import { getDataPath } from '../lib/gameLoader.js';
import { sendRconCommand } from '../lib/rcon.js';
import { getScheduleNextRun } from '../lib/scheduler.js';

const router = Router();

const MAINTENANCE_LEAD_MS = 5 * 60_000;

async function resolveHost() {
  const vpnIp = await getSelfIp();
  const { serverHost } = getSettings();
  return vpnIp ?? (serverHost?.trim() || null) ?? process.env.SERVER_HOST ?? '127.0.0.1';
}

// Soonest enabled restart/stop schedule firing within the lead window, or null.
// Intentionally minimal — no label/cron/command, since this is served publicly.
function getMaintenanceSoon(game) {
  const now = Date.now();
  let soonest = null;
  for (const schedule of game.schedules ?? []) {
    if (!schedule.enabled || (schedule.action !== 'restart' && schedule.action !== 'stop'))
      continue;
    const nextRun = getScheduleNextRun(schedule.id);
    if (!nextRun) continue;
    const at = new Date(nextRun).getTime();
    const delta = at - now;
    if (delta <= 0 || delta > MAINTENANCE_LEAD_MS) continue;
    if (!soonest || at < new Date(soonest.at).getTime()) {
      soonest = { at: nextRun, action: schedule.action };
    }
  }
  return soonest;
}

async function buildServerResponse(game, status, host) {
  const firstPort = game.ports?.[0];
  const [diskUsed, { startedAt, lastActiveAt }] = await Promise.all([
    getDirSizeCached(getDataPath(game.id)),
    getContainerTimestamps(game.id),
  ]);
  return {
    id: game.id,
    name: game.name,
    description: game.description ?? null,
    image: game.image,
    avatarUrl: game.avatar ? `/api/servers/${game.id}/avatar?v=${game.avatarVersion ?? 0}` : null,
    storeUrl: game.storeUrl ?? null,
    status,
    players: getPlayers(game.id),
    playerList: getPlayerList(game.id),
    resourceAlert: getResourceAlert(game.id),
    lastCrash: getLastCrash(game.id),
    actionFailure: getActionFailure(game.id),
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
    // password/listCommand stay server-side (this response is public, no JWT) — but
    // the broadcast template is just command syntax, not a secret, so it's safe to
    // expose and is what the admin Console tab needs to show the quick-action button.
    rcon: game.rcon
      ? {
          enabled: !!game.rcon.enabled,
          port: game.rcon.port ?? null,
          commands: game.rcon.commands ?? null,
        }
      : null,
    maintenanceSoon: getMaintenanceSoon(game),
  };
}

// GET /api/servers — public
router.get('/', async (req, res) => {
  const games = getGames();
  // Host is the same for every game — resolve it once instead of once per
  // game (resolveHost() shells out to the active network provider's CLI on
  // a cache miss).
  const [statuses, host] = await Promise.all([
    getEffectiveStatuses(games.map((g) => g.id)),
    resolveHost(),
  ]);
  const results = await Promise.all(
    games.map((game) => buildServerResponse(game, statuses.get(game.id) ?? 'not_created', host))
  );
  res.json(results);
});

// GET /api/servers/:id — public
router.get('/:id', async (req, res) => {
  const game = getGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  const [status, host] = await Promise.all([getEffectiveStatus(game.id), resolveHost()]);
  res.json(await buildServerResponse(game, status, host));
});

// GET /api/servers/:id/events — JWT (read-only diagnostic history for any
// admin, same "no special permission" treatment as viewing logs or backups).
router.get('/:id/events', verifyToken, (req, res) => {
  const game = getGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  res.json(listEvents(game.id));
});

// DELETE /api/servers/:id/events — JWT + servers:reset (same permission that
// already wipes this game's resourceAlert/lastCrash/actionFailure state on a
// full reset). Clears the whole history, including any still-unresolved row,
// so live listeners are told their current alert is gone too.
router.delete('/:id/events', verifyToken, requirePermission('servers:reset'), (req, res) => {
  const game = getGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  const hadResourceAlert = !!getResourceAlert(game.id);
  const hadCrash = !!getLastCrash(game.id);
  const hadActionFailure = !!getActionFailure(game.id);
  clearEvents(game.id);
  if (hadResourceAlert) emitResourceAlert(game.id, null);
  if (hadCrash) emitCrashUpdate(game.id, null);
  if (hadActionFailure) emitActionFailure(game.id, null);
  res.status(204).end();
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
router.post('/:id/start', verifyToken, requirePermission('servers:power'), async (req, res) => {
  const game = getGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  await startContainer(game);
  res.json({ status: 'running' });
});

// POST /api/servers/:id/stop — JWT
router.post('/:id/stop', verifyToken, requirePermission('servers:power'), async (req, res) => {
  const game = getGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  setPlayers(game.id, null); // before the stop so the final emission carries no players
  setPlayerList(game.id, null);
  if (clearResourceAlert(game.id)) emitResourceAlert(game.id, null);
  await stopContainer(game.id);
  res.json({ status: 'stopped' });
});

// POST /api/servers/:id/restart — JWT
router.post('/:id/restart', verifyToken, requirePermission('servers:power'), async (req, res) => {
  const game = getGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  await restartContainer(game.id);
  res.json({ status: 'running' });
});

// POST /api/servers/:id/rcon — JWT
router.post('/:id/rcon', verifyToken, requirePermission('console:write'), async (req, res) => {
  const game = getGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  if (!game.rcon?.enabled)
    return res.status(400).json({ error: 'RCON is not enabled for this game' });

  const { command } = req.body ?? {};
  if (!command || typeof command !== 'string' || !command.trim()) {
    return res.status(400).json({ error: 'Command is required' });
  }

  const status = await getEffectiveStatus(game.id);
  if (status !== 'running') return res.status(409).json({ error: 'Server is not running' });

  try {
    const response = await sendRconCommand(game, command.trim().slice(0, 1024));
    res.json({ response: response || '(no response)' });
  } catch (err) {
    // sendRconCommand throws specific, actionable messages (auth failed, port
    // not published, timed out, …) — surface those instead of one generic string.
    res.status(503).json({ error: err.message || 'RCON connection failed' });
  }
});

// POST /api/servers/:id/reset — JWT
router.post('/:id/reset', verifyToken, requirePermission('servers:reset'), async (req, res) => {
  if (req.body?.confirm !== true) {
    return res.status(400).json({ error: 'Reset not confirmed' });
  }
  const game = getGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  setPlayers(game.id, null);
  setPlayerList(game.id, null);
  if (clearResourceAlert(game.id)) emitResourceAlert(game.id, null);
  if (clearLastCrash(game.id)) emitCrashUpdate(game.id, null);
  if (clearActionFailure(game.id)) emitActionFailure(game.id, null);
  await resetContainer(game.id);
  res.json({ status: 'not_created' });
});

export default router;
