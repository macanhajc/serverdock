import cron from 'node-cron';
import docker from './docker.js';
import { getGame, saveGame } from './gameLoader.js';
import { startContainer, stopContainer, restartContainer } from './containers.js';
import { createBackup } from './backupManager.js';
import logger from './logger.js';

const jobs = new Map(); // scheduleId -> { task, gameId }

async function sendCommandToContainer(gameId, command) {
  const container = docker.getContainer(`serverdock-${gameId}`);
  const stream = await new Promise((resolve, reject) => {
    container.attach(
      { stream: true, stdin: true, stdout: false, stderr: false },
      (err, s) => (err ? reject(err) : resolve(s))
    );
  });
  stream.write(`${command}\n`);
  stream.end();
}

async function updateLastRun(gameId, scheduleId, ok) {
  const game = getGame(gameId);
  if (!game) return;
  const schedules = (game.schedules ?? []).map((s) =>
    s.id === scheduleId ? { ...s, lastRun: { at: new Date().toISOString(), ok } } : s
  );
  await saveGame(gameId, { schedules }).catch(() => {});
}

async function executeSchedule(gameId, schedule) {
  const game = getGame(gameId);
  if (!game) throw new Error('Game not found');
  if (schedule.action === 'start') await startContainer(game);
  else if (schedule.action === 'stop') await stopContainer(gameId);
  else if (schedule.action === 'restart') await restartContainer(gameId);
  else if (schedule.action === 'command') await sendCommandToContainer(gameId, schedule.command ?? '');
  else if (schedule.action === 'backup') await createBackup(gameId, `Scheduled — ${schedule.label}`);
  else throw new Error(`Unknown action: ${schedule.action}`);
}

export function initScheduler(games) {
  for (const game of games) {
    for (const schedule of game.schedules ?? []) {
      registerSchedule(game.id, schedule);
    }
  }
  logger.info({ count: jobs.size }, 'scheduler initialized');
}

export function registerSchedule(gameId, schedule) {
  if (jobs.has(schedule.id)) unregisterSchedule(schedule.id);

  const options = schedule.timezone ? { timezone: schedule.timezone } : {};

  const task = cron.createTask(schedule.cron, async () => {
    const game = getGame(gameId);
    if (!game) return;
    let ok = true;
    try {
      await executeSchedule(gameId, schedule);
      logger.info({ gameId, scheduleId: schedule.id, action: schedule.action }, 'scheduled action executed');
    } catch (err) {
      ok = false;
      logger.warn({ err, gameId, scheduleId: schedule.id, action: schedule.action }, 'scheduled action failed');
    } finally {
      updateLastRun(gameId, schedule.id, ok).catch(() => {});
    }
  }, options);

  if (schedule.enabled) task.start();
  jobs.set(schedule.id, { task, gameId });
}

export function unregisterSchedule(scheduleId) {
  const entry = jobs.get(scheduleId);
  if (!entry) return;
  entry.task.stop();
  jobs.delete(scheduleId);
}

export function reloadGameSchedules(gameId) {
  const toRemove = [...jobs.entries()]
    .filter(([, { gameId: gId }]) => gId === gameId)
    .map(([schedId]) => schedId);

  for (const schedId of toRemove) {
    jobs.get(schedId).task.stop();
    jobs.delete(schedId);
  }

  const game = getGame(gameId);
  if (!game) return;
  for (const schedule of game.schedules ?? []) {
    registerSchedule(gameId, schedule);
  }
}

export async function runScheduleNow(gameId, scheduleId) {
  const game = getGame(gameId);
  if (!game) throw new Error('Game not found');
  const schedule = (game.schedules ?? []).find((s) => s.id === scheduleId);
  if (!schedule) throw new Error('Schedule not found');

  let ok = true;
  try {
    await executeSchedule(gameId, schedule);
    logger.info({ gameId, scheduleId, action: schedule.action }, 'manual run executed');
  } catch (err) {
    ok = false;
    logger.warn({ err, gameId, scheduleId, action: schedule.action }, 'manual run failed');
    throw err;
  } finally {
    await updateLastRun(gameId, scheduleId, ok).catch(() => {});
  }
}
