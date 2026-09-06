import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { randomUUID } from 'crypto';
import { mkdtemp, rm, mkdir, writeFile, readFile, readdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

// backupManager shells out to the real `tar` binary and touches the real
// filesystem — both are cheap and safe to exercise for real inside a temp
// dir, since that's the actual risk surface (a restore that corrupts or
// loses game data). Only the Docker-touching boundary (containers.js) and
// the game-config lookup (gameLoader.js) are mocked.
const { containersMock, gameLoaderMock } = vi.hoisted(() => ({
  containersMock: {
    getContainerStatus: vi.fn(),
    stopContainer: vi.fn(),
    startContainer: vi.fn(),
  },
  gameLoaderMock: {
    getDataRoot: vi.fn(),
    getDataPath: vi.fn(),
    getGame: vi.fn(),
  },
}));

vi.mock('./containers.js', () => containersMock);
vi.mock('./gameLoader.js', () => gameLoaderMock);

const {
  getBackupsDir,
  getBackupPath,
  listBackups,
  createBackup,
  pruneBackups,
  restoreBackup,
  deleteBackup,
} = await import('./backupManager.js');

let tempRoot;

beforeAll(async () => {
  tempRoot = await mkdtemp(join(tmpdir(), 'serverdock-backups-test-'));
});

afterAll(async () => {
  await rm(tempRoot, { recursive: true, force: true });
});

function fakeGameId() {
  return `game-${randomUUID()}`;
}

function dataPathFor(gameId) {
  return join(tempRoot, gameId, 'data');
}

beforeEach(() => {
  vi.clearAllMocks();
  gameLoaderMock.getDataRoot.mockReturnValue(tempRoot);
  gameLoaderMock.getDataPath.mockImplementation(dataPathFor);
  gameLoaderMock.getGame.mockImplementation((id) => ({ id }));
  containersMock.getContainerStatus.mockResolvedValue('stopped');
  containersMock.stopContainer.mockResolvedValue(undefined);
  containersMock.startContainer.mockResolvedValue(undefined);
});

// --- path safety ---

describe('getBackupPath', () => {
  it('accepts a well-formed UUID backup id', () => {
    const id = randomUUID();
    expect(getBackupPath('mygame', id)).toBe(join(getBackupsDir('mygame'), `${id}.tar.gz`));
  });

  it('rejects a non-UUID backup id, closing off path traversal via the route param', () => {
    expect(() => getBackupPath('mygame', '../../etc/passwd')).toThrow(
      expect.objectContaining({ message: 'Invalid backup id', status: 400 })
    );
  });

  it('rejects an empty or garbage id', () => {
    expect(() => getBackupPath('mygame', '')).toThrow();
    expect(() => getBackupPath('mygame', 'not-a-uuid')).toThrow();
  });
});

// --- create / list / prune / delete ---

describe('createBackup + listBackups', () => {
  it('archives the current data dir and records a sidecar entry', async () => {
    const gameId = fakeGameId();
    await mkdir(dataPathFor(gameId), { recursive: true });
    await writeFile(join(dataPathFor(gameId), 'world.dat'), 'save data');

    const entry = await createBackup(gameId, 'My Backup');

    expect(entry.id).toBeTruthy();
    expect(entry.label).toBe('My Backup');
    expect(entry.size).toBeGreaterThan(0);

    const list = await listBackups(gameId);
    expect(list).toHaveLength(1);
    expect(list[0]).toEqual(entry);
  });

  it('omits the label field entirely when none is given', async () => {
    const gameId = fakeGameId();
    await mkdir(dataPathFor(gameId), { recursive: true });

    const entry = await createBackup(gameId, '');

    expect(entry).not.toHaveProperty('label');
  });

  it('creates a data dir on the fly if the game has never been started', async () => {
    const gameId = fakeGameId(); // no mkdir beforehand
    const entry = await createBackup(gameId, undefined);
    expect(entry.id).toBeTruthy();
  });

  it('prunes down to backupRetention after creating a new backup', async () => {
    const gameId = fakeGameId();
    gameLoaderMock.getGame.mockReturnValue({ id: gameId, backupRetention: 2 });
    await mkdir(dataPathFor(gameId), { recursive: true });

    await createBackup(gameId, 'one');
    await new Promise((r) => setTimeout(r, 20));
    await createBackup(gameId, 'two');
    await new Promise((r) => setTimeout(r, 20));
    await createBackup(gameId, 'three');

    const list = await listBackups(gameId);
    expect(list).toHaveLength(2);
    expect(list.map((b) => b.label)).toEqual(['three', 'two']);
  });
});

describe('pruneBackups', () => {
  it('is a no-op for a non-positive or non-integer keep count', async () => {
    const gameId = fakeGameId();
    expect(await pruneBackups(gameId, 0)).toBe(0);
    expect(await pruneBackups(gameId, -1)).toBe(0);
    expect(await pruneBackups(gameId, 1.5)).toBe(0);
  });
});

describe('deleteBackup', () => {
  it('removes both the archive and its sidecar', async () => {
    const gameId = fakeGameId();
    await mkdir(dataPathFor(gameId), { recursive: true });
    const entry = await createBackup(gameId, 'to delete');

    await deleteBackup(gameId, entry.id);

    const files = await readdir(getBackupsDir(gameId));
    expect(files).toEqual([]);
  });

  it('does not throw when the backup is already gone', async () => {
    const gameId = fakeGameId();
    await expect(deleteBackup(gameId, randomUUID())).resolves.toBeUndefined();
  });
});

// --- restore ---

describe('restoreBackup', () => {
  it('round-trips file contents through backup and restore', async () => {
    const gameId = fakeGameId();
    const dataDir = dataPathFor(gameId);
    await mkdir(dataDir, { recursive: true });
    await writeFile(join(dataDir, 'save.txt'), 'original content');

    const entry = await createBackup(gameId, 'snapshot');

    await writeFile(join(dataDir, 'save.txt'), 'corrupted!!');
    await writeFile(join(dataDir, 'extra.txt'), 'should be gone after restore');

    await restoreBackup(gameId, entry.id);

    const restored = await readFile(join(dataDir, 'save.txt'), 'utf-8');
    expect(restored).toBe('original content');
    const remaining = (await readdir(dataDir)).sort();
    expect(remaining).toEqual(['save.txt']);
  });

  it('stops and restarts the container only if it was running', async () => {
    const gameId = fakeGameId();
    const dataDir = dataPathFor(gameId);
    await mkdir(dataDir, { recursive: true });
    await writeFile(join(dataDir, 'save.txt'), 'v1');
    const entry = await createBackup(gameId, 'snapshot');

    containersMock.getContainerStatus.mockResolvedValue('running');
    const result = await restoreBackup(gameId, entry.id);

    expect(result).toEqual({ wasRunning: true });
    expect(containersMock.stopContainer).toHaveBeenCalledWith(gameId);
    expect(containersMock.startContainer).toHaveBeenCalledWith({ id: gameId });
  });

  it('does not touch the container when it was already stopped', async () => {
    const gameId = fakeGameId();
    const dataDir = dataPathFor(gameId);
    await mkdir(dataDir, { recursive: true });
    await writeFile(join(dataDir, 'save.txt'), 'v1');
    const entry = await createBackup(gameId, 'snapshot');

    const result = await restoreBackup(gameId, entry.id);

    expect(result).toEqual({ wasRunning: false });
    expect(containersMock.stopContainer).not.toHaveBeenCalled();
    expect(containersMock.startContainer).not.toHaveBeenCalled();
  });

  it('rejects with 404 for a backup id that does not exist', async () => {
    const gameId = fakeGameId();
    await expect(restoreBackup(gameId, randomUUID())).rejects.toMatchObject({
      status: 404,
      message: 'Backup not found',
    });
  });

  it('rejects a corrupt archive with 500 and leaves live data untouched', async () => {
    const gameId = fakeGameId();
    const dataDir = dataPathFor(gameId);
    await mkdir(dataDir, { recursive: true });
    await writeFile(join(dataDir, 'save.txt'), 'still here');

    // Plant a fake "backup" that is not actually a valid tar.gz archive.
    const backupsDir = getBackupsDir(gameId);
    await mkdir(backupsDir, { recursive: true });
    const fakeId = randomUUID();
    await writeFile(join(backupsDir, `${fakeId}.tar.gz`), 'not a real archive');

    await expect(restoreBackup(gameId, fakeId)).rejects.toMatchObject({
      status: 500,
      message: 'Backup archive is corrupt or unreadable',
    });

    const restored = await readFile(join(dataDir, 'save.txt'), 'utf-8');
    expect(restored).toBe('still here');
  });
});
