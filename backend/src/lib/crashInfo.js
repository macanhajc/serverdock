// Last unexpected-exit state, persisted in SQLite (see eventLog.js / db.js's
// server_events table) so it survives a backend restart and keeps a bounded
// history per game, not just the most recent crash.
import { recordEvent, getActiveEvent, resolveActiveEvent } from './eventLog.js';

const TYPE = 'crash';

function toCrash(row) {
  return row ? { ...row.data, at: row.createdAt } : null;
}

export function getLastCrash(gameId) {
  return toCrash(getActiveEvent(gameId, TYPE));
}

// `exitInfo` is getContainerExitInfo()'s shape ({ exitCode, oomKilled, error,
// finishedAt }) or null if inspect() failed — `at` comes back from the DB
// row's own created_at rather than being passed in.
export function setLastCrash(gameId, exitInfo) {
  return toCrash(
    recordEvent(gameId, TYPE, {
      exitCode: exitInfo?.exitCode ?? null,
      oomKilled: !!exitInfo?.oomKilled,
      error: exitInfo?.error ?? null,
    })
  );
}

export function clearLastCrash(gameId) {
  return resolveActiveEvent(gameId, TYPE);
}
