import { Router } from 'express';
import bcrypt from 'bcrypt';
import { verifyToken } from '../middleware/auth.js';
import { requireSuperAdmin } from '../middleware/permissions.js';
import {
  listAdmins,
  getAdminById,
  getAdminAuthByUsername,
  getAdminAuthById,
  createAdmin,
  updateAdminPassword,
  updateAdminRole,
  updateAdminPermissions,
  deleteAdmin,
  countSuperAdmins,
  PERMISSIONS,
} from '../lib/adminStore.js';

const router = Router();
const USERNAME_RE = /^[a-z0-9_.-]{3,32}$/i;

function validPermissionList(list) {
  return Array.isArray(list) && list.every((p) => PERMISSIONS.has(p));
}

// GET /api/admins — any admin can see the roster
router.get('/', verifyToken, (req, res) => {
  res.json(listAdmins());
});

// GET /api/admins/permissions — the grantable permission catalog, for the
// admin-form checkbox list (source of truth stays server-side)
router.get('/permissions', verifyToken, (req, res) => {
  res.json([...PERMISSIONS]);
});

// POST /api/admins — super_admin only
router.post('/', verifyToken, requireSuperAdmin, async (req, res) => {
  const { username, password, role = 'admin', permissions = [] } = req.body ?? {};

  if (!username || !USERNAME_RE.test(username)) {
    return res.status(400).json({ error: 'Username must be 3-32 letters, numbers, _ . or -' });
  }
  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  if (!['admin', 'super_admin'].includes(role)) {
    return res.status(400).json({ error: 'role must be admin or super_admin' });
  }
  if (!validPermissionList(permissions)) {
    return res.status(400).json({ error: 'Unknown permission in list' });
  }
  if (getAdminAuthByUsername(username)) {
    return res.status(409).json({ error: 'Username already exists' });
  }

  const admin = await createAdmin({ username, password, role, permissions });
  res.status(201).json(admin);
});

// PATCH /api/admins/me/password — any admin, self-service. Registered before
// PATCH /:id/password so "me" is never captured as an :id.
router.patch('/me/password', verifyToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body ?? {};
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }
  const admin = getAdminAuthById(req.user.sub);
  if (!admin || !currentPassword || !(await bcrypt.compare(currentPassword, admin.password_hash))) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }
  await updateAdminPassword(admin.id, newPassword);
  res.json({ ok: true });
});

// PATCH /api/admins/:id — super_admin only: change role and/or permissions
router.patch('/:id', verifyToken, requireSuperAdmin, (req, res) => {
  const admin = getAdminById(req.params.id);
  if (!admin) return res.status(404).json({ error: 'Admin not found' });

  const { role, permissions } = req.body ?? {};

  if (role !== undefined) {
    if (!['admin', 'super_admin'].includes(role)) {
      return res.status(400).json({ error: 'role must be admin or super_admin' });
    }
    if (admin.role === 'super_admin' && role !== 'super_admin' && countSuperAdmins() <= 1) {
      return res.status(409).json({ error: 'Cannot demote the last super admin' });
    }
    updateAdminRole(req.params.id, role);
  }

  if (permissions !== undefined) {
    if (!validPermissionList(permissions)) {
      return res.status(400).json({ error: 'Unknown permission in list' });
    }
    updateAdminPermissions(req.params.id, permissions);
  }

  res.json(getAdminById(req.params.id));
});

// PATCH /api/admins/:id/password — super_admin resets someone else's password
router.patch('/:id/password', verifyToken, requireSuperAdmin, async (req, res) => {
  const admin = getAdminById(req.params.id);
  if (!admin) return res.status(404).json({ error: 'Admin not found' });

  const { newPassword } = req.body ?? {};
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }
  await updateAdminPassword(req.params.id, newPassword);
  res.json({ ok: true });
});

// DELETE /api/admins/:id — super_admin only
router.delete('/:id', verifyToken, requireSuperAdmin, (req, res) => {
  const admin = getAdminById(req.params.id);
  if (!admin) return res.status(404).json({ error: 'Admin not found' });
  if (admin.id === req.user.sub) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }
  if (admin.role === 'super_admin' && countSuperAdmins() <= 1) {
    return res.status(409).json({ error: 'Cannot delete the last super admin' });
  }
  deleteAdmin(req.params.id);
  res.json({ ok: true });
});

export default router;
