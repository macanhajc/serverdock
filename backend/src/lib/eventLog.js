import db from './db.js';

// Bounded per game — this is a diagnostic tail (resource/crash/action-failure
// alerts), not a general-purpose log, so unbounded growth isn't the goal. An
// open (active) event is always among the newest rows for its game (nothing
// ever resolves an old row and leaves a newer one of the same type active),
// so pruning to the newest N never deletes something still active.
const MAX_EVENTS_PER_GAME = 50;

// Enforced here rather than as a SQL CHECK constraint (which SQLite can't
// ALTER in place — see db.js's rebuild note) so a future addition is just a
// one-line change, not a migration.
const VALID_TYPES = new Set(['resource_high', 'crash', 'action_failed']);

function toRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    gameId: r.game_id,
    type: r.type,
    data: JSON.parse(r.data),
    createdAt: r.created_at,
    resolvedAt: r.resolved_at,
  };
}

// Records a new occurrence of `type` for `gameId` and returns it as the now-
// active event for that (gameId, type) pair. Each call always inserts a new
// row — an earlier still-unresolved row of the same type (e.g. two failed
// start attempts before either is fixed) is left alone rather than merged,
// so every distinct occurrence keeps its own history entry; resolving later
// clears all of them at once (see resolveActiveEvent).
export function recordEvent(gameId, type, data) {
  if (!VALID_TYPES.has(type)) throw new Error(`Unknown server_events type: ${type}`);
  db.prepare(
    'INSERT INTO server_events (game_id, type, data, created_at) VALUES (?, ?, ?, ?)'
  ).run(gameId, type, JSON.stringify(data), new Date().toISOString());
  pruneEvents(gameId);
  return getActiveEvent(gameId, type);
}

// The still-unresolved event of this type for a game, if any — this IS the
// "current alert" / "current crash" state; there's no separate in-memory cache.
// Ties on created_at (millisecond resolution — easily hit under fast
// successive writes) break on id, i.e. insertion order.
export function getActiveEvent(gameId, type) {
  return toRow(
    db
      .prepare(
        `SELECT * FROM server_events
         WHERE game_id = ? AND type = ? AND resolved_at IS NULL
         ORDER BY created_at DESC, id DESC LIMIT 1`
      )
      .get(gameId, type)
  );
}

// Resolves any still-open event(s) of this type for a game. Returns true if
// something was actually resolved, so callers only need to broadcast a clear
// when there was something to clear.
export function resolveActiveEvent(gameId, type) {
  const { changes } = db
    .prepare(
      `UPDATE server_events SET resolved_at = ?
       WHERE game_id = ? AND type = ? AND resolved_at IS NULL`
    )
    .run(new Date().toISOString(), gameId, type);
  return changes > 0;
}

// Full history for a game, newest first — what the detail page's event log shows.
export function listEvents(gameId, limit = MAX_EVENTS_PER_GAME) {
  return db
    .prepare(
      'SELECT * FROM server_events WHERE game_id = ? ORDER BY created_at DESC, id DESC LIMIT ?'
    )
    .all(gameId, limit)
    .map(toRow);
}

// Wipes the entire history for a game, including any still-unresolved row —
// callers are responsible for telling live listeners (resourceAlert/lastCrash/
// actionFailure) that their current alert is now gone, the same way a reset does.
export function clearEvents(gameId) {
  db.prepare('DELETE FROM server_events WHERE game_id = ?').run(gameId);
}

function pruneEvents(gameId) {
  db.prepare(
    `DELETE FROM server_events WHERE game_id = ? AND id NOT IN (
       SELECT id FROM server_events WHERE game_id = ? ORDER BY created_at DESC, id DESC LIMIT ?
     )`
  ).run(gameId, gameId, MAX_EVENTS_PER_GAME);
}
