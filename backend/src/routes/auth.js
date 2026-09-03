import { Router } from 'express';
import { randomUUID } from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { verifyToken } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { revokeToken } from '../lib/tokenRevocation.js';
import { getAdminAuthByUsername, touchLastLogin, getPermissions } from '../lib/adminStore.js';

const router = Router();

const loginRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });

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
