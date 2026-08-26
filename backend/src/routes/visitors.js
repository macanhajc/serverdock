import { Router } from 'express';
import { verifyToken } from '../middleware/auth.js';
import {
  getVisitors,
  getById,
  getByToken,
  getByUsername,
  createVisitor,
  updateVisitor,
  removeVisitor,
} from '../lib/visitorStore.js';
import { isIpBlocked, blockIp, unblockIp, getBlockedIps } from '../lib/blocklistStore.js';
import { getSettings } from '../lib/settingsStore.js';

const router = Router();

const USERNAME_RE = /^[a-z0-9_-]+$/i;

// POST /api/visitors/identify — public
router.post('/identify', async (req, res) => {
  const { token, username } = req.body ?? {};
  const ip = req.ip ?? req.socket?.remoteAddress ?? '';
  const userAgent = req.headers['user-agent'] ?? '';

  // Returning visitor — validate their token
  if (token) {
    const visitor = getByToken(token);
    if (visitor) {
      if (isIpBlocked(ip)) return res.status(403).json({ error: 'blocked' });
      await updateVisitor(visitor.id, { ip, lastSeen: new Date().toISOString() });
      return res.json({ id: visitor.id, username: visitor.username, token: visitor.token });
    }
    // Token not found — fall through to registration
  }

  // New visitor — check IP block before anything else
  if (isIpBlocked(ip)) return res.status(403).json({ error: 'blocked' });

  // Check registration is open
  if (!getSettings().registrationOpen) {
    return res.status(403).json({ error: 'registration_closed' });
  }

  // New visitor — require username
  if (!username || typeof username !== 'string') {
    return res.status(400).json({ error: 'Username is required' });
  }

  const trimmed = username.trim();
  if (trimmed.length < 2 || trimmed.length > 20) {
    return res.status(400).json({ error: 'Username must be 2–20 characters' });
  }
  if (!USERNAME_RE.test(trimmed)) {
    return res.status(400).json({ error: 'Username may only contain letters, numbers, _ and -' });
  }
  if (getByUsername(trimmed)) {
    return res.status(409).json({ error: 'Username already taken' });
  }

  const visitor = await createVisitor({ username: trimmed, ip, userAgent });
  res.status(201).json({ id: visitor.id, username: visitor.username, token: visitor.token });
});

// GET /api/visitors — admin only
router.get('/', verifyToken, (_req, res) => {
  res.json(getVisitors().map((v) => ({ ...v, blocked: isIpBlocked(v.ip) })));
});

// GET /api/visitors/blocklist — admin only. Lists blocked IPs directly, since
// an IP can stay blocked after the visitor row that set it has been removed.
router.get('/blocklist', verifyToken, (_req, res) => {
  res.json(getBlockedIps());
});

// DELETE /api/visitors/blocklist/:ip — admin only, unblock an IP directly
// (needed for IPs blocked from a visitor row that no longer exists).
router.delete('/blocklist/:ip', verifyToken, async (req, res) => {
  const removed = await unblockIp(decodeURIComponent(req.params.ip));
  if (!removed) return res.status(404).json({ error: 'IP not in blocklist' });
  res.json({ ok: true });
});

// PATCH /api/visitors/:id/block — admin only
router.patch('/:id/block', verifyToken, async (req, res) => {
  const visitor = getById(req.params.id);
  if (!visitor) return res.status(404).json({ error: 'Visitor not found' });
  await blockIp(visitor.ip);
  res.json({ ok: true });
});

// PATCH /api/visitors/:id/unblock — admin only
router.patch('/:id/unblock', verifyToken, async (req, res) => {
  const visitor = getById(req.params.id);
  if (!visitor) return res.status(404).json({ error: 'Visitor not found' });
  await unblockIp(visitor.ip);
  res.json({ ok: true });
});

// DELETE /api/visitors/:id — admin only. Only removes the visitor row — any
// IP block set from it is untouched (see blocklistStore.js).
router.delete('/:id', verifyToken, async (req, res) => {
  const removed = await removeVisitor(req.params.id);
  if (!removed) return res.status(404).json({ error: 'Visitor not found' });
  res.json({ ok: true });
});

export default router;
