import { readFile, writeFile, rename } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORE_PATH = join(__dirname, '../../../blocklist.json');
const TMP_PATH = STORE_PATH + '.tmp';

// Kept separate from visitors.json so blocking an IP survives removal of the
// visitor row it was set from — deleting a visitor is a distinct action from
// unblocking their IP.
let blockedIps = [];

export async function loadBlocklist() {
  try {
    const raw = await readFile(STORE_PATH, 'utf8');
    blockedIps = JSON.parse(raw);
  } catch {
    blockedIps = [];
  }
}

let writeChain = Promise.resolve();

function persist() {
  const run = async () => {
    await writeFile(TMP_PATH, JSON.stringify(blockedIps, null, 2));
    await rename(TMP_PATH, STORE_PATH);
  };
  writeChain = writeChain.then(run, run);
  return writeChain;
}

export function getBlockedIps() {
  return [...blockedIps].sort((a, b) => new Date(b.blockedAt) - new Date(a.blockedAt));
}

export function isIpBlocked(ip) {
  if (!ip) return false;
  return blockedIps.some((b) => b.ip === ip);
}

export async function blockIp(ip) {
  if (!ip || isIpBlocked(ip)) return;
  blockedIps.push({ ip, blockedAt: new Date().toISOString() });
  await persist();
}

export async function unblockIp(ip) {
  const before = blockedIps.length;
  blockedIps = blockedIps.filter((b) => b.ip !== ip);
  if (blockedIps.length < before) await persist();
  return blockedIps.length < before;
}
