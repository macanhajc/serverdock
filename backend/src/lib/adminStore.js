import { randomUUID } from 'crypto';
import bcrypt from 'bcrypt';
import db from './db.js';

const BCRYPT_ROUNDS = 12;

// Fixed catalog of grantable capabilities — a plain 'admin' has none of these
// until a super_admin checks the box; 'super_admin' has all of them implicitly
// and is never itself grantable (that would let an admin escalate itself).
export const PERMISSIONS = new Set([
  'servers:power',
  'servers:reset',
  'games:create',
  'games:edit',
  'games:delete',
  'files:write',
  'backups:manage',
  'console:write',
  'visitors:manage',
  'schedules:manage',
  'settings:manage',
]);

function toPublic(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
    permissions: row.role === 'super_admin' ? null : getPermissions(row.id),
  };
}

export function listAdmins() {
  return db.prepare('SELECT * FROM admins ORDER BY created_at ASC').all().map(toPublic);
}

export function getAdminById(id) {
  return toPublic(db.prepare('SELECT * FROM admins WHERE id = ?').get(id));
}

// Internal — includes password_hash, for login / password verification only.
export function getAdminAuthByUsername(username) {
  return db.prepare('SELECT * FROM admins WHERE username = ? COLLATE NOCASE').get(username);
}

export function getAdminAuthById(id) {
  return db.prepare('SELECT * FROM admins WHERE id = ?').get(id);
}

export function countSuperAdmins() {
  return db.prepare("SELECT COUNT(*) AS n FROM admins WHERE role = 'super_admin'").get().n;
}

export function countAdmins() {
  return db.prepare('SELECT COUNT(*) AS n FROM admins').get().n;
}

export function getPermissions(adminId) {
  return db
    .prepare('SELECT permission FROM admin_permissions WHERE admin_id = ?')
    .all(adminId)
    .map((r) => r.permission);
}

export function hasPermission(adminId, permission) {
  return !!db
    .prepare('SELECT 1 FROM admin_permissions WHERE admin_id = ? AND permission = ?')
    .get(adminId, permission);
}

function setPermissions(adminId, permissions) {
  const del = db.prepare('DELETE FROM admin_permissions WHERE admin_id = ?');
  const ins = db.prepare('INSERT INTO admin_permissions (admin_id, permission) VALUES (?, ?)');
  db.transaction((perms) => {
    del.run(adminId);
    for (const p of perms) {
      if (PERMISSIONS.has(p)) ins.run(adminId, p);
    }
  })(permissions ?? []);
}

export async function createAdmin({ username, password, role = 'admin', permissions = [] }) {
  const id = randomUUID();
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  db.prepare(
    'INSERT INTO admins (id, username, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(id, username, passwordHash, role, new Date().toISOString());
  // super_admin has everything implicitly — no rows needed for it
  if (role !== 'super_admin') setPermissions(id, permissions);
  return getAdminById(id);
}

// First-run web setup: creates the initial super_admin, but only if none
// exists yet. The count-check and insert run inside one synchronous
// transaction with no `await` in between, so two simultaneous setup
// requests can't both succeed — better-sqlite3 transactions run
// synchronously and Node is single-threaded, so nothing can interleave
// between the check and the insert. Returns null if setup was already done.
export async function createFirstAdmin({ username, password }) {
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const created = db.transaction(() => {
    const { n } = db.prepare('SELECT COUNT(*) AS n FROM admins').get();
    if (n > 0) return false;
    db.prepare(
      'INSERT INTO admins (id, username, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(id, username, passwordHash, 'super_admin', createdAt);
    return true;
  })();
  return created ? getAdminById(id) : null;
}

export async function updateAdminPassword(id, password) {
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  db.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(passwordHash, id);
}

export function updateAdminRole(id, role) {
  db.prepare('UPDATE admins SET role = ? WHERE id = ?').run(role, id);
  // Promoting to super_admin makes explicit grants redundant — drop them so
  // permissions always reflects "what this admin needs if ever demoted".
  if (role === 'super_admin') setPermissions(id, []);
}

export function updateAdminPermissions(id, permissions) {
  setPermissions(id, permissions);
}

export function deleteAdmin(id) {
  db.prepare('DELETE FROM admins WHERE id = ?').run(id);
}

export function touchLastLogin(id) {
  db.prepare('UPDATE admins SET last_login_at = ? WHERE id = ?').run(new Date().toISOString(), id);
}
