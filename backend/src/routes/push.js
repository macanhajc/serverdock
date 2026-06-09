import { Router } from 'express';
import { verifyToken } from '../middleware/auth.js';
import { getSettings, saveSettings } from '../lib/settingsStore.js';
import { testPushNotification } from '../lib/notifier.js';

const router = Router();

// GET /api/push/vapid-public-key — public
router.get('/vapid-public-key', (req, res) => {
  const { vapidPublicKey } = getSettings();
  if (!vapidPublicKey) return res.status(503).json({ error: 'Push not configured' });
  res.json({ publicKey: vapidPublicKey });
});

// POST /api/push/subscribe — JWT
router.post('/subscribe', verifyToken, async (req, res) => {
  const sub = req.body;
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    return res.status(400).json({ error: 'Invalid subscription object' });
  }
  const { pushSubscriptions = [] } = getSettings();
  const deduped = pushSubscriptions.filter((s) => s.endpoint !== sub.endpoint);
  await saveSettings({ pushSubscriptions: [...deduped, sub] });
  res.json({ ok: true });
});

// DELETE /api/push/subscribe — JWT
router.delete('/subscribe', verifyToken, async (req, res) => {
  const { endpoint } = req.body ?? {};
  if (!endpoint) return res.status(400).json({ error: 'endpoint required' });
  const { pushSubscriptions = [] } = getSettings();
  await saveSettings({ pushSubscriptions: pushSubscriptions.filter((s) => s.endpoint !== endpoint) });
  res.json({ ok: true });
});

// POST /api/push/test — JWT
router.post('/test', verifyToken, async (req, res) => {
  const { endpoint } = req.body ?? {};
  try {
    await testPushNotification(endpoint);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
