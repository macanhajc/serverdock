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
