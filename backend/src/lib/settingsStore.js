import { readFile, writeFile, rename } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Tests set SETTINGS_PATH to a temp file before importing this module so they
// never touch the real settings.json (same override pattern as db.js's DB_PATH).
const SETTINGS_PATH = process.env.SETTINGS_PATH ?? join(__dirname, '../../settings.json');
const TMP_PATH = `${SETTINGS_PATH}.tmp`;

const DEFAULTS = {
  dataRoot: '',
  serverHost: '',
  registrationOpen: true,
  discordWebhookUrl: '',
  vapidPublicKey: '',
  vapidPrivateKey: '',
  pushSubscriptions: [],
  // Auto-generated fallback for process.env.JWT_SECRET when the operator
  // hasn't supplied one (e.g. a Docker install with no .env) — see index.js.
  generatedJwtSecret: '',
};

let settings = { ...DEFAULTS };

export async function loadSettings() {
  try {
    const raw = await readFile(SETTINGS_PATH, 'utf-8');
    settings = { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    settings = { ...DEFAULTS };
  }
  return settings;
}

export function getSettings() {
  return settings;
}

// Serialize writes so two concurrent saveSettings calls (e.g. a push
// subscription registering while the admin edits settings) can't race on the
// shared .tmp file — see the identical pattern in visitorStore.js.
let writeChain = Promise.resolve();

export async function saveSettings(update) {
  settings = { ...settings, ...update };
  const snapshot = settings;
  const run = async () => {
    await writeFile(TMP_PATH, JSON.stringify(snapshot, null, 2));
    await rename(TMP_PATH, SETTINGS_PATH);
  };
  writeChain = writeChain.then(run, run);
  await writeChain;
  return settings;
}
