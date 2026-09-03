import { describe, it, expect, beforeEach } from 'vitest';
import bcrypt from 'bcrypt';
import db from './db.js';
import {
  PERMISSIONS,
  listAdmins,
  getAdminById,
  getAdminAuthByUsername,
  getAdminAuthById,
  countSuperAdmins,
  getPermissions,
  hasPermission,
  createAdmin,
  updateAdminPassword,
  updateAdminRole,
  updateAdminPermissions,
  deleteAdmin,
  touchLastLogin,
} from './adminStore.js';

beforeEach(() => {
  db.exec('DELETE FROM admin_permissions; DELETE FROM admins;');
});

describe('createAdmin', () => {
  it('hashes the password instead of storing it in plaintext', async () => {
    await createAdmin({ username: 'alice', password: 'hunter22' });
    const row = getAdminAuthByUsername('alice');
    expect(row.password_hash).not.toBe('hunter22');
    expect(await bcrypt.compare('hunter22', row.password_hash)).toBe(true);
  });

  it('defaults to the admin role', async () => {
    const admin = await createAdmin({ username: 'bob', password: 'hunter22' });
    expect(admin.role).toBe('admin');
  });

  it('only grants permissions from the fixed catalog, silently dropping unknown ones', async () => {
    const admin = await createAdmin({
      username: 'carol',
      password: 'hunter22',
      permissions: ['servers:power', 'not:a:real:permission'],
    });
    expect(admin.permissions).toEqual(['servers:power']);
  });

  it('ignores requested permissions for a super_admin — it has everything implicitly', async () => {
    const admin = await createAdmin({
      username: 'dave',
      password: 'hunter22',
      role: 'super_admin',
      permissions: ['servers:power'],
    });
    // toPublic() reports null permissions for super_admin (meaning "all")
    expect(admin.permissions).toBeNull();
    expect(getPermissions(admin.id)).toEqual([]);
  });

  it('looks up an admin by username case-insensitively', async () => {
    await createAdmin({ username: 'Eve', password: 'hunter22' });
    expect(getAdminAuthByUsername('eve')).toBeTruthy();
    expect(getAdminAuthByUsername('EVE')).toBeTruthy();
  });
});

describe('hasPermission', () => {
  it('is true only for permissions actually granted to that admin', async () => {
    const admin = await createAdmin({
      username: 'frank',
      password: 'hunter22',
      permissions: ['servers:power'],
    });
    expect(hasPermission(admin.id, 'servers:power')).toBe(true);
    expect(hasPermission(admin.id, 'files:write')).toBe(false);
  });
});

describe('updateAdminRole', () => {
  it('strips explicit permission grants when promoting to super_admin', async () => {
    const admin = await createAdmin({
      username: 'grace',
      password: 'hunter22',
      permissions: ['servers:power', 'files:write'],
    });
    expect(getPermissions(admin.id)).toHaveLength(2);

    updateAdminRole(admin.id, 'super_admin');

    expect(getPermissions(admin.id)).toEqual([]);
    expect(getAdminById(admin.id).role).toBe('super_admin');
  });
});

describe('updateAdminPermissions', () => {
  it('fully replaces the previous grant set rather than merging into it', async () => {
    const admin = await createAdmin({
      username: 'heidi',
      password: 'hunter22',
      permissions: ['servers:power', 'files:write'],
    });

    updateAdminPermissions(admin.id, ['console:write']);

    expect(getPermissions(admin.id)).toEqual(['console:write']);
  });
});

describe('updateAdminPassword', () => {
  it('replaces the stored hash so only the new password verifies', async () => {
    const admin = await createAdmin({ username: 'ivan', password: 'old-password' });
    await updateAdminPassword(admin.id, 'new-password');

    const row = getAdminAuthById(admin.id);
    expect(await bcrypt.compare('old-password', row.password_hash)).toBe(false);
    expect(await bcrypt.compare('new-password', row.password_hash)).toBe(true);
  });
});

describe('deleteAdmin', () => {
  it('cascades and removes the admin’s permission grants too', async () => {
    const admin = await createAdmin({
      username: 'judy',
      password: 'hunter22',
      permissions: ['servers:power'],
    });

    deleteAdmin(admin.id);

    expect(getAdminById(admin.id)).toBeNull();
    expect(db.prepare('SELECT * FROM admin_permissions WHERE admin_id = ?').all(admin.id)).toEqual(
      []
    );
  });
});

describe('touchLastLogin', () => {
  it('sets last_login_at', async () => {
    const admin = await createAdmin({ username: 'kim', password: 'hunter22' });
    expect(getAdminById(admin.id).lastLoginAt).toBeNull();

    touchLastLogin(admin.id);

    expect(getAdminById(admin.id).lastLoginAt).not.toBeNull();
  });
});

describe('countSuperAdmins', () => {
  it('counts only super_admin rows', async () => {
    await createAdmin({ username: 'liam', password: 'hunter22', role: 'super_admin' });
    await createAdmin({ username: 'mia', password: 'hunter22', role: 'admin' });
    expect(countSuperAdmins()).toBe(1);
  });
});

describe('listAdmins', () => {
  it('lists every admin, oldest first', async () => {
    await createAdmin({ username: 'noah', password: 'hunter22' });
    await createAdmin({ username: 'olivia', password: 'hunter22' });
    const usernames = listAdmins().map((a) => a.username);
    expect(usernames).toEqual(['noah', 'olivia']);
  });
});

describe('PERMISSIONS catalog', () => {
  it('never includes super_admin as a grantable permission', () => {
    expect(PERMISSIONS.has('super_admin')).toBe(false);
  });
});
