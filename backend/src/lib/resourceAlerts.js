// Sustained-high-resource-usage state, persisted in SQLite (see eventLog.js /
// db.js's server_events table) so it survives a backend restart and keeps a
// bounded history per game, not just the current alert.
import { recordEvent, getActiveEvent, resolveActiveEvent } from './eventLog.js';

const TYPE = 'resource_high';

function toAlert(row) {
  return row ? { ...row.data, since: row.createdAt } : null;
}

export function getResourceAlert(gameId) {
  return toAlert(getActiveEvent(gameId, TYPE));
}

// `alert` is { cpu, memPct, message } — `since` comes back from the DB row's
// own created_at rather than being passed in, so it's always the actual
// persisted timestamp.
export function setResourceAlert(gameId, alert) {
  return toAlert(recordEvent(gameId, TYPE, alert));
}

export function clearResourceAlert(gameId) {
  return resolveActiveEvent(gameId, TYPE);
}
