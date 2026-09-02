import { Router } from 'express';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { verifyToken } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { revokeToken } from '../lib/tokenRevocation.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AUTH_FILE = join(__dirname, '../../auth.json');

const router = Router();

const loginRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });

// POST /api/auth/login
router.post('/login', loginRateLimit, async (req, res) => {
  const { username, password } = req.body ?? {};
  if (!username || !password) {
    return res.status(400).json({ error: 'username and password required' });
  }

  let stored;
  try {
    stored = JSON.parse(await readFile(AUTH_FILE, 'utf-8'));
  } catch {
    return res.status(500).json({ error: 'Auth not configured — run setup-auth.js' });
  }

  const valid =
    username === stored.username && (await bcrypt.compare(password, stored.passwordHash));
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ username, jti: randomUUID() }, process.env.JWT_SECRET, {
    expiresIn: '24h',
  });
  res.json({ token, expiresIn: 86400 });
});

// POST /api/auth/logout
router.post('/logout', verifyToken, async (req, res) => {
  revokeToken(req.user.jti, req.user.exp);
  res.json({ message: 'Logged out' });
});

export default router;
