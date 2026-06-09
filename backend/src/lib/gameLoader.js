import { readdir, readFile, writeFile, rename } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getSettings } from './settingsStore.js';
import logger from './logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const GAMES_DIR = join(__dirname, '../../games');

const REQUIRED = ['id', 'name', 'imageSource', 'image', 'ports'];

let games = [];

export async function loadGames() {
  try {
    const folders = await readdir(GAMES_DIR, { withFileTypes: true });
    const loaded = [];
    for (const entry of folders) {
      if (!entry.isDirectory()) continue;
      const jsonPath = join(GAMES_DIR, entry.name, `${entry.name}.json`);
      try {
        const raw = await readFile(jsonPath, 'utf-8');
        const game = JSON.parse(raw);
        const missing = REQUIRED.filter((f) => game[f] === undefined);
        if (missing.length) {
          logger.warn({ game: entry.name, missing }, 'skipping game: missing fields');
          continue;
        }
        loaded.push(game);
      } catch {
        logger.warn({ game: entry.name }, 'skipping game: missing or invalid JSON');
      }
    }
    games = loaded;
    logger.info({ count: games.length }, 'games loaded');
  } catch {
    logger.warn('games/ directory not found or unreadable');
  }
  return games;
}

export function getGames() {
  return games;
}

export function getGame(id) {
  return games.find((g) => g.id === id) ?? null;
}

// Returns the configured data root, falling back to GAMES_DIR when no custom path is set.
export function getDataRoot() {
  const { dataRoot } = getSettings();
  return dataRoot && dataRoot.trim() ? dataRoot.trim() : GAMES_DIR;
}

// Host-side path for a game's persistent data volume.
// Structure: <dataRoot>/<id>/data
export function getDataPath(id) {
  return join(getDataRoot(), id, 'data');
}

export async function saveGame(id, partialData) {
  const game = getGame(id);
  if (!game) throw new Error(`Game ${id} not found`);
  const updated = { ...game, ...partialData };
  const jsonPath = join(GAMES_DIR, id, `${id}.json`);
  const tmpPath = `${jsonPath}.tmp`;
  await writeFile(tmpPath, JSON.stringify(updated, null, 2), 'utf-8');
  await rename(tmpPath, jsonPath);
  const idx = games.findIndex((g) => g.id === id);
  if (idx !== -1) games[idx] = updated;
  return updated;
}
