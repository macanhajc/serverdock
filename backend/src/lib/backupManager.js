import { execFile } from 'child_process';
import { promisify } from 'util';
import { mkdir, rm, rename, readdir, readFile, writeFile, unlink, access } from 'fs/promises';
import { join, dirname } from 'path';
import { randomUUID } from 'crypto';
import { getDataRoot, getDataPath, getGame } from './gameLoader.js';
import { getContainerStatus, stopContainer, startContainer } from './containers.js';
import logger from './logger.js';

const execFileAsync = promisify(execFile);

export function getBackupsDir(gameId) {
  return join(getDataRoot(), gameId, 'backups');
}

export function getBackupPath(gameId, backupId) {
  return join(getBackupsDir(gameId), `${backupId}.tar.gz`);
}

function getSidecarPath(gameId, backupId) {
  return join(getBackupsDir(gameId), `${backupId}.json`);
}

export async function listBackups(gameId) {
  const dir = getBackupsDir(gameId);
  try {
    const entries = await readdir(dir);
    const results = [];
    for (const f of entries) {
      if (!f.endsWith('.json')) continue;
      const id = f.slice(0, -5);
      try {
        await access(join(dir, `${id}.tar.gz`));
        const raw = await readFile(join(dir, f), 'utf-8');
        results.push(JSON.parse(raw));
      } catch {
        // sidecar without matching archive or unreadable — skip
      }
    }
    results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return results;
  } catch {
    return [];
  }
}

export async function createBackup(gameId, label) {
  const dataDir = getDataPath(gameId);
  const backupsDir = getBackupsDir(gameId);

  await mkdir(backupsDir, { recursive: true });
  await mkdir(dataDir, { recursive: true });

  const id = randomUUID();
  const backupPath = join(backupsDir, `${id}.tar.gz`);
  const sidecarPath = join(backupsDir, `${id}.json`);

  await execFileAsync('tar', ['-czf', backupPath, '-C', dataDir, '.']);

  const { stdout } = await execFileAsync('du', ['-b', backupPath]);
  const size = parseInt(stdout.split('\t')[0], 10);

  const entry = {
    id,
    ...(label?.trim() ? { label: label.trim() } : {}),
    createdAt: new Date().toISOString(),
    size: isNaN(size) ? 0 : size,
  };

  await writeFile(sidecarPath, JSON.stringify(entry, null, 2), 'utf-8');
  logger.info({ gameId, backupId: id, size: entry.size }, 'backup created');

  const keep = getGame(gameId)?.backupRetention;
  if (Number.isInteger(keep) && keep > 0) {
    await pruneBackups(gameId, keep).catch((err) =>
      logger.warn({ err, gameId }, 'backup prune failed')
    );
  }

  return entry;
}

// Delete the oldest backups beyond `keep`. Returns the number removed.
export async function pruneBackups(gameId, keep) {
  if (!Number.isInteger(keep) || keep < 1) return 0;
  const backups = await listBackups(gameId); // newest first
  const excess = backups.slice(keep);
  for (const b of excess) {
    await deleteBackup(gameId, b.id);
  }
  if (excess.length) logger.info({ gameId, removed: excess.length, keep }, 'backups pruned');
  return excess.length;
}

export async function restoreBackup(gameId, backupId) {
  const backupPath = getBackupPath(gameId, backupId);

  try {
    await access(backupPath);
  } catch {
    throw Object.assign(new Error('Backup not found'), { status: 404 });
  }

  const dataDir = getDataPath(gameId);
  const gameDir = dirname(dataDir);

  // Extract into a temp dir first — if the archive is corrupt, live data is untouched
  const tmpDir = join(gameDir, `.restore-${backupId}-${Date.now()}`);
  await mkdir(tmpDir, { recursive: true });
  try {
    await execFileAsync('tar', ['-xzf', backupPath, '-C', tmpDir]);
  } catch (err) {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    logger.warn({ err, gameId, backupId }, 'backup extract failed');
    throw Object.assign(new Error('Backup archive is corrupt or unreadable'), { status: 500 });
  }

  const status = await getContainerStatus(gameId);
  const wasRunning = status === 'running';

  if (wasRunning) await stopContainer(gameId);

  const oldDir = join(gameDir, `.data-old-${Date.now()}`);
  let hadData = true;
  try {
    await rename(dataDir, oldDir);
  } catch {
    hadData = false; // data dir didn't exist
  }
  await rename(tmpDir, dataDir);
  if (hadData) await rm(oldDir, { recursive: true, force: true }).catch(() => {});

  if (wasRunning) {
    const game = getGame(gameId);
    if (game) await startContainer(game);
  }

  logger.info({ gameId, backupId }, 'backup restored');
  return { wasRunning };
}

export async function deleteBackup(gameId, backupId) {
  await Promise.allSettled([
    unlink(getBackupPath(gameId, backupId)),
    unlink(getSidecarPath(gameId, backupId)),
  ]);
  logger.info({ gameId, backupId }, 'backup deleted');
}
