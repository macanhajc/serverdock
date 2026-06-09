import { Router } from 'express';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { verifyToken } from '../middleware/auth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AUTH_FILE = join(__dirname, '../../auth.json');

const router = Router();

// In-memory rate limiter: max 10 login attempts per IP per 15 min
const loginAttempts = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return false;
  }
  entry.count += 1;
  return entry.count > 10;
}

function clearAttempts(ip) {
  loginAttempts.delete(ip);
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const ip = req.ip ?? req.socket?.remoteAddress ?? 'unknown';
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Too many login attempts. Try again in 15 minutes.' });
  }

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

  clearAttempts(ip);
  const token = jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: '24h' });
  res.json({ token, expiresIn: 86400 });
});

// POST /api/auth/logout — Phase 2
router.post('/logout', verifyToken, async (req, res) => {
  res.json({ message: 'Logged out' });
});

export default router;
