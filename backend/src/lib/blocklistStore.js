import db from './db.js';

export function getBlockedIps() {
  return db
    .prepare('SELECT ip, blocked_at AS blockedAt FROM blocked_ips ORDER BY blocked_at DESC')
    .all();
}

export function isIpBlocked(ip) {
  if (!ip) return false;
  return !!db.prepare('SELECT 1 FROM blocked_ips WHERE ip = ?').get(ip);
}

export async function blockIp(ip) {
  if (!ip) return;
  db.prepare('INSERT OR IGNORE INTO blocked_ips (ip, blocked_at) VALUES (?, ?)').run(
    ip,
    new Date().toISOString()
  );
}

export async function unblockIp(ip) {
  return db.prepare('DELETE FROM blocked_ips WHERE ip = ?').run(ip).changes > 0;
}
