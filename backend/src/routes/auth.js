import { Router } from 'express';
import { randomUUID } from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { verifyToken } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { revokeToken } from '../lib/tokenRevocation.js';
import {
  getAdminAuthByUsername,
  touchLastLogin,
  getPermissions,
  countAdmins,
  createFirstAdmin,
} from '../lib/adminStore.js';

const router = Router();
const USERNAME_RE = /^[a-z0-9_.-]{3,32}$/i;

const loginRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });
const setupRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });

// POST /api/auth/login
router.post('/login', loginRateLimit, async (req, res) => {
  const { username, password } = req.body ?? {};
  if (!username || !password) {
    return res.status(400).json({ error: 'username and password required' });
  }

  const admin = getAdminAuthByUsername(username);
  const valid = admin && (await bcrypt.compare(password, admin.password_hash));
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  touchLastLogin(admin.id);

  const token = jwt.sign(
    { sub: admin.id, username: admin.username, role: admin.role, jti: randomUUID() },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
  res.json({ token, expiresIn: 86400 });
});

// GET /api/auth/setup-status — public. Tells the frontend whether to show
// the first-run "create your admin account" screen instead of the login
// screen. Reads the live admin count, so it stays correct across the
// legacyMigration.js import that runs once at boot, before the server ever
// starts accepting requests.
router.get('/setup-status', (req, res) => {
  res.json({ needsSetup: countAdmins() === 0 });
});

// POST /api/auth/setup — public, but self-disabling: only ever succeeds
// once, the very first time, and only ever creates a super_admin. Meant to
// replace the setup-auth.js CLI script for users without Node/npm on the
// host; the CLI script still works for headless installs and lockout
// recovery.
router.post('/setup', setupRateLimit, async (req, res) => {
  const { username, password } = req.body ?? {};
  if (!username || !USERNAME_RE.test(username)) {
    return res.status(400).json({ error: 'Username must be 3-32 letters, numbers, _ . or -' });
  }
  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const admin = await createFirstAdmin({ username, password });
  if (!admin) {
    return res.status(409).json({ error: 'Setup already completed' });
  }

  // Log the new admin straight in — same response shape as POST /login —
  // so the first-run screen can go directly into the admin panel.
  const token = jwt.sign(
    { sub: admin.id, username: admin.username, role: admin.role, jti: randomUUID() },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
  res.status(201).json({ token, expiresIn: 86400 });
});

// POST /api/auth/logout
router.post('/logout', verifyToken, async (req, res) => {
  revokeToken(req.user.jti, req.user.exp);
  res.json({ message: 'Logged out' });
});

// GET /api/auth/me — who am I, for the frontend to gate UI. `permissions:
// null` means "all" (super_admin); otherwise it's the live grant list.
router.get('/me', verifyToken, (req, res) => {
  res.json({
    username: req.user.username,
    role: req.user.role,
    permissions: req.user.role === 'super_admin' ? null : getPermissions(req.user.sub),
  });
});

export default router;
