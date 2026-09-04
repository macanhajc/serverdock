// Persisted start/restart failures — see eventLog.js / db.js's server_events
// table. Scoped to start/restart only: those are the two actions whose
// failure leaves the server not running with no other visible explanation
// (a failed stop/reset leaves status exactly as it already visibly was).
import { recordEvent, getActiveEvent, resolveActiveEvent } from './eventLog.js';

const TYPE = 'action_failed';
// Generous but bounded — dockerode/Docker daemon errors are normally a
// one-liner, but a raw stack trace can run long; this is a debugging aid,
// not something meant to be exhaustive.
const MAX_MESSAGE_LEN = 1000;
const MAX_STACK_LEN = 4000;

function toFailure(row) {
  return row ? { ...row.data, at: row.createdAt } : null;
}

export function getActionFailure(gameId) {
  return toFailure(getActiveEvent(gameId, TYPE));
}

// `action` is 'start' | 'restart'; `err` is the thrown Error — `at` comes
// back from the DB row's own created_at rather than being passed in.
export function setActionFailure(gameId, action, err) {
  const message = String(err?.message ?? err ?? '').slice(0, MAX_MESSAGE_LEN);
  const stack = typeof err?.stack === 'string' ? err.stack.slice(0, MAX_STACK_LEN) : null;
  return toFailure(recordEvent(gameId, TYPE, { action, message, stack }));
}

export function clearActionFailure(gameId) {
  return resolveActiveEvent(gameId, TYPE);
}
