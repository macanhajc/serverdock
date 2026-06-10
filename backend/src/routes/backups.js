import { createReadStream } from 'fs';
import { Router } from 'express';
import { verifyToken } from '../middleware/auth.js';
import { getGame, saveGame } from '../lib/gameLoader.js';
import {
  listBackups,
  createBackup,
  restoreBackup,
  deleteBackup,
  pruneBackups,
  getBackupPath,
} from '../lib/backupManager.js';

const router = Router();

// GET /api/backups/:id
router.get('/:id', verifyToken, async (req, res) => {
  const game = getGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  const backups = await listBackups(req.params.id);
  res.json({ backups, retention: game.backupRetention ?? 0 });
});

// PUT /api/backups/:id/retention — keep last N backups (0 = keep all)
router.put('/:id/retention', verifyToken, async (req, res) => {
  const game = getGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });

  const keep = req.body?.keep;
  if (!Number.isInteger(keep) || keep < 0 || keep > 1000) {
    return res.status(400).json({ error: 'keep must be an integer between 0 and 1000' });
  }

  await saveGame(req.params.id, { backupRetention: keep });
  if (keep > 0) await pruneBackups(req.params.id, keep);
  const backups = await listBackups(req.params.id);
  res.json({ backups, retention: keep });
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
// Authorization header only — the frontend downloads via fetch + blob so the
// JWT never lands in a URL (browser history / access logs).
router.get('/:id/:backupId/download', verifyToken, (req, res) => {
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
