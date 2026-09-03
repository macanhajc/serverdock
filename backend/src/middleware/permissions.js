import { hasPermission } from '../lib/adminStore.js';

// super_admin always passes; a plain admin needs a live grant. Looked up fresh
// from SQLite per request (not baked into the JWT) so revoking a permission
// takes effect immediately instead of waiting out the token's 24h lifetime.
export function requirePermission(permission) {
  return (req, res, next) => {
    if (req.user?.role === 'super_admin') return next();
    if (req.user?.sub && hasPermission(req.user.sub, permission)) return next();
    return res.status(403).json({ error: 'Insufficient permissions' });
  };
}

// Admin-account management is never a grantable permission — only
// super_admin can create/edit/delete admins or change their grants.
export function requireSuperAdmin(req, res, next) {
  if (req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Super admin access required' });
  }
  next();
}
