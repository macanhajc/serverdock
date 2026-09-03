// CLI bootstrap/recovery tool. Creates a super admin if the username doesn't
// exist yet, or resets its password (and ensures super_admin) if it does —
// the recovery path for when every admin account is locked out.
import {
  getAdminAuthByUsername,
  createAdmin,
  updateAdminPassword,
  updateAdminRole,
} from './src/lib/adminStore.js';

const args = process.argv.slice(2);
const get = (flag) => {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : null;
};

const username = get('--username');
const password = get('--password');

if (!username || !password) {
  console.error('Usage: node setup-auth.js --username <name> --password <pass>');
  console.error(
    'Creates a super admin if the username does not exist; otherwise resets its password and ensures it is a super admin.'
  );
  process.exit(1);
}

if (password.length < 8) {
  console.error('Password must be at least 8 characters');
  process.exit(1);
}

const existing = getAdminAuthByUsername(username);
if (existing) {
  await updateAdminPassword(existing.id, password);
  updateAdminRole(existing.id, 'super_admin');
  console.log(`Password reset and super_admin role ensured for "${username}"`);
} else {
  await createAdmin({ username, password, role: 'super_admin' });
  console.log(`Super admin "${username}" created`);
}

process.exit(0);
