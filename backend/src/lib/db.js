import Database from 'better-sqlite3';
import { chmodSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Tests set DB_PATH=':memory:' (or a temp file) before importing this module
// so they never touch the real serverdock.db.
export const DB_PATH = process.env.DB_PATH ?? join(__dirname, '../../serverdock.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// One-time rebuild: server_events originally shipped with a CHECK constraint
// listing only ('resource_high', 'crash') as valid types. SQLite can't ALTER
// a CHECK constraint in place, and 'action_failed' was added after some
// installs already had the table — so an existing table carrying the old
// constraint gets rebuilt (rows preserved) before the schema below, which no
// longer declares one; validity is enforced in eventLog.js instead, so
// future additions never need this dance again.
const existingServerEvents = db
  .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'server_events'")
  .get();
if (existingServerEvents?.sql.includes("CHECK (type IN ('resource_high', 'crash'))")) {
  db.exec(`
    ALTER TABLE server_events RENAME TO server_events_pre_action_failed;
    CREATE TABLE server_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id TEXT NOT NULL,
      type TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL,
      resolved_at TEXT
    );
    INSERT INTO server_events SELECT * FROM server_events_pre_action_failed;
    DROP TABLE server_events_pre_action_failed;
  `);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS admins (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('super_admin', 'admin')) DEFAULT 'admin',
    created_at TEXT NOT NULL,
    last_login_at TEXT
  );

  CREATE TABLE IF NOT EXISTS admin_permissions (
    admin_id TEXT NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
    permission TEXT NOT NULL,
    PRIMARY KEY (admin_id, permission)
  );

  CREATE TABLE IF NOT EXISTS visitors (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    token TEXT NOT NULL UNIQUE,
    ip TEXT,
    user_agent TEXT,
    first_seen TEXT NOT NULL,
    last_seen TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS visitor_ips (
    visitor_id TEXT NOT NULL REFERENCES visitors(id) ON DELETE CASCADE,
    ip TEXT NOT NULL,
    last_seen TEXT NOT NULL,
    PRIMARY KEY (visitor_id, ip)
  );

  CREATE TABLE IF NOT EXISTS blocked_ips (
    ip TEXT PRIMARY KEY,
    blocked_at TEXT NOT NULL
  );

  -- Sustained-resource / crash / failed-action events (see eventLog.js).
  -- resolved_at is NULL while the condition is still active — that's also
  -- how "current alert" is derived, there's no separate cache. Bounded per
  -- game (see eventLog.js's MAX_EVENTS_PER_GAME) — this is operational
  -- telemetry, not a general log. Valid type values are enforced in
  -- eventLog.js, not here (see the rebuild note above).
  CREATE TABLE IF NOT EXISTS server_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id TEXT NOT NULL,
    type TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL,
    resolved_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_server_events_game_created
    ON server_events (game_id, created_at DESC, id DESC);
  CREATE INDEX IF NOT EXISTS idx_server_events_active
    ON server_events (game_id, type, resolved_at);
`);

// Best-effort — irrelevant on Windows dev boxes, matters on the Ubuntu host this
// project actually ships to (matches the "owner-readable only" treatment auth.json got).
// Skipped for in-memory test databases, which have no path to chmod.
if (DB_PATH !== ':memory:') {
  try {
    chmodSync(DB_PATH, 0o600);
  } catch {
    // ignore
  }
}

export default db;
