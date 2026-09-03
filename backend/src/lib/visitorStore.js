import { randomUUID } from 'crypto';
import db from './db.js';

const upsertIp = db.prepare(`
  INSERT INTO visitor_ips (visitor_id, ip, last_seen) VALUES (?, ?, ?)
  ON CONFLICT (visitor_id, ip) DO UPDATE SET last_seen = excluded.last_seen
`);

function rowToVisitor(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    token: row.token,
    ip: row.ip,
    userAgent: row.user_agent,
    firstSeen: row.first_seen,
    lastSeen: row.last_seen,
  };
}

export function getVisitors() {
  return db.prepare('SELECT * FROM visitors ORDER BY last_seen DESC').all().map(rowToVisitor);
}

export function getByToken(token) {
  return rowToVisitor(db.prepare('SELECT * FROM visitors WHERE token = ?').get(token));
}

export function getByUsername(username) {
  return rowToVisitor(
    db.prepare('SELECT * FROM visitors WHERE username = ? COLLATE NOCASE').get(username)
  );
}

export function getById(id) {
  return rowToVisitor(db.prepare('SELECT * FROM visitors WHERE id = ?').get(id));
}

export async function createVisitor({ username, ip, userAgent }) {
  const now = new Date().toISOString();
  const visitor = {
    id: randomUUID(),
    username,
    token: randomUUID(),
    ip: ip || null,
    userAgent: userAgent ?? '',
    firstSeen: now,
    lastSeen: now,
  };
  db.prepare(
    `INSERT INTO visitors (id, username, token, ip, user_agent, first_seen, last_seen) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    visitor.id,
    visitor.username,
    visitor.token,
    visitor.ip,
    visitor.userAgent,
    visitor.firstSeen,
    visitor.lastSeen
  );
  if (visitor.ip) upsertIp.run(visitor.id, visitor.ip, visitor.lastSeen);
  return visitor;
}

// Only `ip`/`lastSeen` are ever patched by callers today (a returning visitor
// re-identifying) — every IP a visitor connects from is also tracked in
// visitor_ips, even though the row itself only surfaces the most recent one.
export async function updateVisitor(id, patch) {
  const existing = db.prepare('SELECT * FROM visitors WHERE id = ?').get(id);
  if (!existing) return null;

  const ip = patch.ip !== undefined ? patch.ip : existing.ip;
  const lastSeen = patch.lastSeen !== undefined ? patch.lastSeen : existing.last_seen;

  db.prepare('UPDATE visitors SET ip = ?, last_seen = ? WHERE id = ?').run(ip, lastSeen, id);
  if (ip) upsertIp.run(id, ip, lastSeen);

  return rowToVisitor(db.prepare('SELECT * FROM visitors WHERE id = ?').get(id));
}

export async function removeVisitor(id) {
  return db.prepare('DELETE FROM visitors WHERE id = ?').run(id).changes > 0;
}
