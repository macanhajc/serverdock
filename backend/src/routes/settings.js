import { Router } from 'express';
import { verifyToken } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permissions.js';
import { getSettings, saveSettings } from '../lib/settingsStore.js';
import { GAMES_DIR, getGames } from '../lib/gameLoader.js';
import { resetContainer } from '../lib/containers.js';
import { getIo } from '../lib/socket.js';
import { setPlayers } from '../lib/playerQuery.js';
import { testDiscordWebhook } from '../lib/notifier.js';
import logger from '../lib/logger.js';

const router = Router();

// GET /api/settings/public — no auth, exposes only safe fields
router.get('/public', (req, res) => {
  res.json({ registrationOpen: getSettings().registrationOpen });
});

// GET /api/settings
router.get('/', verifyToken, (req, res) => {
  const {
    dataRoot,
    serverHost,
    registrationOpen,
    discordWebhookUrl,
    vapidPublicKey,
    pushSubscriptions,
  } = getSettings();
  res.json({
    dataRoot,
    serverHost,
    registrationOpen,
    discordWebhookUrl,
    vapidPublicKey,
    pushSubscriptionCount: (pushSubscriptions ?? []).length,
    defaultDataRoot: GAMES_DIR,
  });
});

// PUT /api/settings
router.put('/', verifyToken, requirePermission('settings:manage'), async (req, res) => {
  const { dataRoot, serverHost, registrationOpen, discordWebhookUrl } = req.body ?? {};
  if (dataRoot !== undefined && typeof dataRoot !== 'string') {
    return res.status(400).json({ error: 'dataRoot must be a string' });
  }
  if (serverHost !== undefined && typeof serverHost !== 'string') {
    return res.status(400).json({ error: 'serverHost must be a string' });
  }
  if (registrationOpen !== undefined && typeof registrationOpen !== 'boolean') {
    return res.status(400).json({ error: 'registrationOpen must be a boolean' });
  }
  if (discordWebhookUrl !== undefined && typeof discordWebhookUrl !== 'string') {
    return res.status(400).json({ error: 'discordWebhookUrl must be a string' });
  }
  const patch = {};
  if (dataRoot !== undefined) patch.dataRoot = dataRoot;
  if (serverHost !== undefined) patch.serverHost = serverHost;
  if (registrationOpen !== undefined) patch.registrationOpen = registrationOpen;
  if (discordWebhookUrl !== undefined) patch.discordWebhookUrl = discordWebhookUrl;
  const updated = await saveSettings(patch);
  const { vapidPublicKey, pushSubscriptions } = updated;
  res.json({
    dataRoot: updated.dataRoot,
    serverHost: updated.serverHost,
    registrationOpen: updated.registrationOpen,
    discordWebhookUrl: updated.discordWebhookUrl,
    vapidPublicKey,
    pushSubscriptionCount: (pushSubscriptions ?? []).length,
    defaultDataRoot: GAMES_DIR,
  });
});

// POST /api/settings/notify/test-discord — JWT
router.post(
  '/notify/test-discord',
  verifyToken,
  requirePermission('settings:manage'),
  async (req, res) => {
    const { discordWebhookUrl } = getSettings();
    if (!discordWebhookUrl?.trim())
      return res.status(400).json({ error: 'No webhook URL configured' });
    try {
      await testDiscordWebhook(discordWebhookUrl);
      res.json({ ok: true });
    } catch (err) {
      res.status(502).json({ error: err.message });
    }
  }
);

// POST /api/settings/wipe-all
router.post('/wipe-all', verifyToken, requirePermission('settings:manage'), async (req, res) => {
  if (req.body?.confirm !== true) {
    return res.status(400).json({ error: 'Wipe not confirmed' });
  }
  const games = getGames();
  let wiped = 0;
  for (const game of games) {
    try {
      await resetContainer(game.id);
      setPlayers(game.id, null);
      getIo()
        ?.to('status')
        .emit('status:update', { id: game.id, status: 'not_created', players: null });
      wiped++;
    } catch (err) {
      logger.error({ gameId: game.id, err }, 'wipe-all: failed to reset game');
    }
  }
  res.json({ wiped });
});

export default router;
