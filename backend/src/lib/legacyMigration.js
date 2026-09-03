import { readFile, rename } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import db from './db.js';
import logger from './logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');

// Reads and parses a legacy JSON store, hands it to `apply` inside the
// caller's control, then renames the file out of the way (never deletes —
// this is the rollback path if the migration needs to be undone by hand).
async function migrateFile(filename, apply) {
  const path = join(ROOT, filename);
  let raw;
  try {
    raw = await readFile(path, 'utf-8');
  } catch (err) {
    if (err.code === 'ENOENT') return;
    throw err;
  }
  apply(JSON.parse(raw));
  await rename(path, `${path}.migrated`);
  logger.info({ file: filename }, 'migrated legacy JSON store into serverdock.db');
}

// Runs once at startup. Each store only migrates if its table is still empty,
// so this is a no-op on every boot after the first.
export async function migrateLegacyData() {
  const adminCount = db.prepare('SELECT COUNT(*) AS n FROM admins').get().n;
  if (adminCount === 0) {
    await migrateFile('auth.json', (stored) => {
      if (!stored?.username || !stored?.passwordHash) return;
      db.prepare(
        `INSERT INTO admins (id, username, password_hash, role, created_at) VALUES (?, ?, ?, 'super_admin', ?)`
      ).run(randomUUID(), stored.username, stored.passwordHash, new Date().toISOString());
    });
  }

  const visitorCount = db.prepare('SELECT COUNT(*) AS n FROM visitors').get().n;
  if (visitorCount === 0) {
    await migrateFile('visitors.json', (visitors) => {
      const insertVisitor = db.prepare(
        `INSERT INTO visitors (id, username, token, ip, user_agent, first_seen, last_seen) VALUES (?, ?, ?, ?, ?, ?, ?)`
      );
      const insertIp = db.prepare(
        `INSERT OR IGNORE INTO visitor_ips (visitor_id, ip, last_seen) VALUES (?, ?, ?)`
      );
      db.transaction((rows) => {
        for (const v of rows) {
          insertVisitor.run(
            v.id,
            v.username,
            v.token,
            v.ip ?? null,
            v.userAgent ?? '',
            v.firstSeen,
            v.lastSeen
          );
          if (v.ip) insertIp.run(v.id, v.ip, v.lastSeen);
        }
      })(Array.isArray(visitors) ? visitors : []);
    });
  }

  const blockedCount = db.prepare('SELECT COUNT(*) AS n FROM blocked_ips').get().n;
  if (blockedCount === 0) {
    await migrateFile('blocklist.json', (blocked) => {
      const insert = db.prepare('INSERT OR IGNORE INTO blocked_ips (ip, blocked_at) VALUES (?, ?)');
      db.transaction((rows) => {
        for (const b of rows) insert.run(b.ip, b.blockedAt);
      })(Array.isArray(blocked) ? blocked : []);
    });
  }
}
