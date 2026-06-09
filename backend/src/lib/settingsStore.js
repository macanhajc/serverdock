import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SETTINGS_PATH = join(__dirname, '../../settings.json');

const DEFAULTS = {
  dataRoot: '',
  serverHost: '',
  registrationOpen: true,
  discordWebhookUrl: '',
  vapidPublicKey: '',
  vapidPrivateKey: '',
  pushSubscriptions: [],
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

export async function saveSettings(update) {
  settings = { ...settings, ...update };
  await writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2));
  return settings;
}
