import { createReadStream } from 'fs';
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { verifyToken } from '../middleware/auth.js';
import { getGame } from '../lib/gameLoader.js';
import {
  listBackups,
  createBackup,
  restoreBackup,
  deleteBackup,
  getBackupPath,
} from '../lib/backupManager.js';

const router = Router();

// GET /api/backups/:id
router.get('/:id', verifyToken, async (req, res) => {
  const game = getGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  const backups = await listBackups(req.params.id);
  res.json(backups);
});

// POST /api/backups/:id
router.post('/:id', verifyToken, async (req, res) => {
  const game = getGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  try {
    const entry = await createBackup(req.params.id, req.body?.label);
    res.status(201).json(entry);
  } catch (err) {
    res.status(500).json({ error: err.message ?? 'Backup failed' });
  }
});

// GET /api/backups/:id/:backupId/download
// Accepts token via Authorization header or ?token= query param (for browser <a> links).
router.get('/:id/:backupId/download', (req, res) => {
  const raw = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : req.query.token;

  if (!raw) return res.status(401).json({ error: 'Missing token' });
  try {
    jwt.verify(raw, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const game = getGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });

  const backupPath = getBackupPath(req.params.id, req.params.backupId);
  const filename = `${req.params.id}-${req.params.backupId}.tar.gz`;

  res.setHeader('Content-Type', 'application/gzip');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const stream = createReadStream(backupPath);
  stream.on('error', () => {
    if (!res.headersSent) res.status(404).json({ error: 'Backup file not found' });
  });
  stream.pipe(res);
});

// POST /api/backups/:id/:backupId/restore
router.post('/:id/:backupId/restore', verifyToken, async (req, res) => {
  const game = getGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  try {
    const result = await restoreBackup(req.params.id, req.params.backupId);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Restore failed' });
  }
});

// DELETE /api/backups/:id/:backupId
router.delete('/:id/:backupId', verifyToken, async (req, res) => {
  const game = getGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  await deleteBackup(req.params.id, req.params.backupId);
  res.json({ ok: true });
});

export default router;
