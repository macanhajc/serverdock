import { describe, it, expect, beforeEach, vi } from 'vitest';
import db from '../lib/db.js';
import { createAdmin } from '../lib/adminStore.js';
import { requirePermission, requireSuperAdmin } from './permissions.js';

beforeEach(() => {
  db.exec('DELETE FROM admin_permissions; DELETE FROM admins;');
});

function mockRes() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('requirePermission', () => {
  it('lets a super_admin through regardless of granted permissions', () => {
    const req = { user: { role: 'super_admin', sub: 'irrelevant' } };
    const res = mockRes();
    const next = vi.fn();

    requirePermission('servers:power')(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('lets a plain admin through when the permission is granted in SQLite', async () => {
    const admin = await createAdmin({
      username: 'perm-yes',
      password: 'hunter22',
      permissions: ['servers:power'],
    });
    const req = { user: { role: 'admin', sub: admin.id } };
    const res = mockRes();
    const next = vi.fn();

    requirePermission('servers:power')(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('rejects a plain admin who lacks the permission with 403', async () => {
    const admin = await createAdmin({
      username: 'perm-no',
      password: 'hunter22',
      permissions: [],
    });
    const req = { user: { role: 'admin', sub: admin.id } };
    const res = mockRes();
    const next = vi.fn();

    requirePermission('servers:power')(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Insufficient permissions' });
  });

  it('rejects when a permission is revoked, even mid-token-lifetime', async () => {
    const admin = await createAdmin({
      username: 'perm-revoked',
      password: 'hunter22',
      permissions: ['servers:power'],
    });
    const req = { user: { role: 'admin', sub: admin.id } };
    const middleware = requirePermission('servers:power');

    // Simulates the token staying valid while the grant is revoked out from under it —
    // permissions are looked up fresh per request, not cached on the JWT.
    middleware(req, mockRes(), vi.fn());
    const { updateAdminPermissions } = await import('../lib/adminStore.js');
    updateAdminPermissions(admin.id, []);

    const res = mockRes();
    const next = vi.fn();
    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('requireSuperAdmin', () => {
  it('lets a super_admin through', () => {
    const req = { user: { role: 'super_admin' } };
    const res = mockRes();
    const next = vi.fn();

    requireSuperAdmin(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('rejects a plain admin with 403', () => {
    const req = { user: { role: 'admin' } };
    const res = mockRes();
    const next = vi.fn();

    requireSuperAdmin(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Super admin access required' });
  });
});
