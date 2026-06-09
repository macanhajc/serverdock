import { writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';

const __dirname = dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const get = (flag) => {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : null;
};

const username = get('--username');
const password = get('--password');

if (!username || !password) {
  console.error('Usage: node setup-auth.js --username <name> --password <pass>');
  process.exit(1);
}

const passwordHash = await bcrypt.hash(password, 12);
const out = join(__dirname, 'auth.json');
await writeFile(out, JSON.stringify({ username, passwordHash }, null, 2));
console.log(`auth.json written for user "${username}"`);
