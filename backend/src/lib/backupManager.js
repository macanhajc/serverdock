import { execFile } from 'child_process';
import { promisify } from 'util';
import { mkdir, rm, readdir, readFile, writeFile, unlink, access } from 'fs/promises';
import { join } from 'path';
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
  return entry;
}

export async function restoreBackup(gameId, backupId) {
  const backupPath = getBackupPath(gameId, backupId);

  try {
    await access(backupPath);
  } catch {
    throw Object.assign(new Error('Backup not found'), { status: 404 });
  }

  const dataDir = getDataPath(gameId);
  const status = await getContainerStatus(gameId);
  const wasRunning = status === 'running';

  if (wasRunning) await stopContainer(gameId);

  await rm(dataDir, { recursive: true, force: true });
  await mkdir(dataDir, { recursive: true });
  await execFileAsync('tar', ['-xzf', backupPath, '-C', dataDir]);

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
