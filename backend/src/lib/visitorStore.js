import { readFile, writeFile, rename } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORE_PATH = join(__dirname, '../../../visitors.json');
const TMP_PATH = STORE_PATH + '.tmp';

let visitors = [];

export async function loadVisitors() {
  try {
    const raw = await readFile(STORE_PATH, 'utf8');
    visitors = JSON.parse(raw);
  } catch {
    visitors = [];
  }
}

// Serialize writes. Concurrent identify requests would otherwise race on the
// shared .tmp file: one rename moves it to visitors.json before the other's
// rename runs, so the second fails with ENOENT. Chaining guarantees exactly one
// writeFile→rename at a time. `run` is used for both fulfil and reject so a
// failed write never stalls the queue; each caller still sees its own outcome.
let writeChain = Promise.resolve();

function persist() {
  const run = async () => {
    await writeFile(TMP_PATH, JSON.stringify(visitors, null, 2));
    await rename(TMP_PATH, STORE_PATH);
  };
  writeChain = writeChain.then(run, run);
  return writeChain;
}

export function getVisitors() {
  return [...visitors].sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen));
}

export function getByToken(token) {
  return visitors.find((v) => v.token === token) ?? null;
}

export function getByUsername(username) {
  const lower = username.toLowerCase();
  return visitors.find((v) => v.username.toLowerCase() === lower) ?? null;
}

export function getById(id) {
  return visitors.find((v) => v.id === id) ?? null;
}

export async function createVisitor({ username, ip, userAgent }) {
  const now = new Date().toISOString();
  const visitor = {
    id: randomUUID(),
    username,
    token: randomUUID(),
    ip,
    userAgent: userAgent ?? '',
    firstSeen: now,
    lastSeen: now,
  };
  visitors.push(visitor);
  await persist();
  return visitor;
}

export async function updateVisitor(id, patch) {
  const idx = visitors.findIndex((v) => v.id === id);
  if (idx === -1) return null;
  visitors[idx] = { ...visitors[idx], ...patch };
  await persist();
  return visitors[idx];
}

export async function removeVisitor(id) {
  const before = visitors.length;
  visitors = visitors.filter((v) => v.id !== id);
  if (visitors.length < before) await persist();
  return visitors.length < before;
}
