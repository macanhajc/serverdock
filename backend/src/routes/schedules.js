import { Router } from 'express';
import { randomUUID } from 'crypto';
import cron from 'node-cron';
import { verifyToken } from '../middleware/auth.js';
import { getGame, saveGame } from '../lib/gameLoader.js';
import { reloadGameSchedules, runScheduleNow, getScheduleNextRun } from '../lib/scheduler.js';

const router = Router();

const withNextRun = (s) => ({ ...s, nextRun: getScheduleNextRun(s.id) });

function validateTimezone(tz) {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// GET /api/schedules/:id
router.get('/:id', verifyToken, (req, res) => {
  const game = getGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  res.json((game.schedules ?? []).map(withNextRun));
});

// POST /api/schedules/:id
router.post('/:id', verifyToken, async (req, res) => {
  const game = getGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });

  const { label, action, cron: cronExpr, command, timezone, enabled = true } = req.body;

  if (!label?.trim() || !action || !cronExpr?.trim()) {
    return res.status(400).json({ error: 'label, action, and cron are required' });
  }
  if (!['start', 'stop', 'restart', 'command', 'backup'].includes(action)) {
    return res.status(400).json({ error: 'action must be start, stop, restart, command, or backup' });
  }
  if (action === 'command' && !command?.trim()) {
    return res.status(400).json({ error: 'command is required for command action' });
  }
  if (!cron.validate(cronExpr.trim())) {
    return res.status(400).json({ error: 'Invalid cron expression' });
  }
  if (timezone !== undefined && timezone.trim() && !validateTimezone(timezone.trim())) {
    return res.status(400).json({ error: 'Invalid timezone' });
  }

  const newSchedule = {
    id: randomUUID(),
    label: label.trim(),
    action,
    ...(action === 'command' ? { command: command.trim() } : {}),
    cron: cronExpr.trim(),
    ...(timezone?.trim() ? { timezone: timezone.trim() } : {}),
    enabled: Boolean(enabled),
  };

  const schedules = [...(game.schedules ?? []), newSchedule];
  await saveGame(req.params.id, { schedules });
  reloadGameSchedules(req.params.id);

  res.status(201).json(withNextRun(newSchedule));
});

// PUT /api/schedules/:id/:scheduleId
router.put('/:id/:scheduleId', verifyToken, async (req, res) => {
  const game = getGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });

  const existing = (game.schedules ?? []).find((s) => s.id === req.params.scheduleId);
  if (!existing) return res.status(404).json({ error: 'Schedule not found' });

  const { label, action, cron: cronExpr, command, timezone, enabled } = req.body;

  if (action !== undefined && !['start', 'stop', 'restart', 'command', 'backup'].includes(action)) {
    return res.status(400).json({ error: 'action must be start, stop, restart, command, or backup' });
  }
  const resolvedAction = action ?? existing.action;
  if (resolvedAction === 'command') {
    const resolvedCommand = command ?? existing.command;
    if (!resolvedCommand?.trim()) {
      return res.status(400).json({ error: 'command is required for command action' });
    }
  }
  if (cronExpr !== undefined && !cron.validate(cronExpr.trim())) {
    return res.status(400).json({ error: 'Invalid cron expression' });
  }
  if (timezone !== undefined && timezone.trim() && !validateTimezone(timezone.trim())) {
    return res.status(400).json({ error: 'Invalid timezone' });
  }

  const updated = {
    ...existing,
    ...(label !== undefined ? { label: label.trim() } : {}),
    ...(action !== undefined ? { action } : {}),
    ...(command !== undefined ? { command: command.trim() } : resolvedAction !== 'command' ? { command: undefined } : {}),
    ...(cronExpr !== undefined ? { cron: cronExpr.trim() } : {}),
    ...(timezone !== undefined ? { timezone: timezone.trim() || undefined } : {}),
    ...(enabled !== undefined ? { enabled: Boolean(enabled) } : {}),
  };

  // Remove undefined keys (clean up command field when switching away from command action)
  if (updated.action !== 'command') delete updated.command;
  if (!updated.timezone) delete updated.timezone;

  const schedules = (game.schedules ?? []).map((s) =>
    s.id === req.params.scheduleId ? updated : s
  );
  await saveGame(req.params.id, { schedules });
  reloadGameSchedules(req.params.id);

  res.json(withNextRun(updated));
});

// POST /api/schedules/:id/:scheduleId/run — trigger immediately
router.post('/:id/:scheduleId/run', verifyToken, async (req, res) => {
  const game = getGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  const existing = (game.schedules ?? []).find((s) => s.id === req.params.scheduleId);
  if (!existing) return res.status(404).json({ error: 'Schedule not found' });

  try {
    await runScheduleNow(req.params.id, req.params.scheduleId);
    const updated = getGame(req.params.id);
    const schedule = (updated?.schedules ?? []).find((s) => s.id === req.params.scheduleId);
    res.json(withNextRun(schedule ?? existing));
  } catch (err) {
    const updated = getGame(req.params.id);
    const schedule = (updated?.schedules ?? []).find((s) => s.id === req.params.scheduleId);
    res.status(502).json({ error: err.message, schedule: schedule ? withNextRun(schedule) : undefined });
  }
});

// DELETE /api/schedules/:id/:scheduleId
router.delete('/:id/:scheduleId', verifyToken, async (req, res) => {
  const game = getGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });

  const existing = (game.schedules ?? []).find((s) => s.id === req.params.scheduleId);
  if (!existing) return res.status(404).json({ error: 'Schedule not found' });

  const schedules = (game.schedules ?? []).filter((s) => s.id !== req.params.scheduleId);
  await saveGame(req.params.id, { schedules });
  reloadGameSchedules(req.params.id);

  res.json({ ok: true });
});

export default router;
