import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir, platform } from 'os';
import { withinSandbox, sandboxResolve, sandboxRealpath } from './files.js';

describe('withinSandbox', () => {
  const root = join('C:', 'games', 'mygame', 'data');

  it('accepts the root itself', () => {
    expect(withinSandbox(root, root)).toBe(true);
  });

  it('accepts a path nested under the root', () => {
    expect(withinSandbox(root, join(root, 'config', 'server.properties'))).toBe(true);
  });

  it('rejects a sibling directory that merely shares the root as a string prefix', () => {
    // e.g. root "…/mygame/data" vs "…/mygame/data-evil/secret" — a naive
    // p.startsWith(root) check (without the separator) would wrongly allow this.
    const sibling = root + '-evil';
    expect(withinSandbox(root, join(sibling, 'secret.txt'))).toBe(false);
  });

  it('rejects a path outside the root entirely', () => {
    expect(withinSandbox(root, join('C:', 'etc', 'passwd'))).toBe(false);
  });
});

describe('sandboxResolve', () => {
  const root = join('C:', 'games', 'mygame', 'data');

  it('resolves a plain relative path under the root', () => {
    expect(sandboxResolve(root, 'config.txt')).toBe(join(root, 'config.txt'));
  });

  it('resolves a nested relative path', () => {
    expect(sandboxResolve(root, 'world/level.dat')).toBe(join(root, 'world', 'level.dat'));
  });

  it('defaults an empty/undefined path to the root', () => {
    expect(sandboxResolve(root, undefined)).toBe(root);
    expect(sandboxResolve(root, '')).toBe(root);
  });

  it('rejects ../ traversal that climbs out of the root', () => {
    expect(sandboxResolve(root, '../outside.txt')).toBeNull();
    expect(sandboxResolve(root, '../../../etc/passwd')).toBeNull();
  });

  it('rejects ../ traversal buried inside an otherwise-normal-looking path', () => {
    expect(sandboxResolve(root, 'world/../../outside.txt')).toBeNull();
  });

  it('treats a leading slash as root-relative rather than an OS-root escape', () => {
    // Client paths always mean "relative to the sandbox root", even if the
    // client sends a leading slash — this is intentional, not an escape.
    expect(sandboxResolve(root, '/config.txt')).toBe(join(root, 'config.txt'));
  });
});

describe('sandboxRealpath', () => {
  let tempRoot;
  let sandboxRoot;
  let outsideDir;
  let canSymlink = true;

  beforeAll(async () => {
    tempRoot = await mkdtemp(join(tmpdir(), 'serverdock-sandbox-test-'));
    sandboxRoot = join(tempRoot, 'sandbox');
    outsideDir = join(tempRoot, 'outside');
    await mkdir(sandboxRoot, { recursive: true });
    await mkdir(outsideDir, { recursive: true });
    await writeFile(join(sandboxRoot, 'file.txt'), 'hello');
    await writeFile(join(outsideDir, 'secret.txt'), 'top secret');

    try {
      await symlink(
        outsideDir,
        join(sandboxRoot, 'escape'),
        platform() === 'win32' ? 'junction' : undefined
      );
    } catch {
      // Creating filesystem symlinks/junctions can require elevated privileges
      // on some Windows setups — skip just the symlink-dependent assertions there.
      canSymlink = false;
    }
  });

  afterAll(async () => {
    await rm(tempRoot, { recursive: true, force: true });
  });

  it('resolves a real file that exists under the root', async () => {
    const { real, err } = await sandboxRealpath(sandboxRoot, 'file.txt');
    expect(err).toBeUndefined();
    expect(real).toBe(join(sandboxRoot, 'file.txt'));
  });

  it('returns 404 for a path that does not exist', async () => {
    const { err } = await sandboxRealpath(sandboxRoot, 'nope.txt');
    expect(err).toBe(404);
  });

  it('returns 403 for pure path-math traversal before ever touching the filesystem', async () => {
    const { err } = await sandboxRealpath(sandboxRoot, '../outside/secret.txt');
    expect(err).toBe(403);
  });

  it('returns 403 for a symlink that resolves outside the sandbox root', async () => {
    if (!canSymlink) return;
    const { err } = await sandboxRealpath(sandboxRoot, 'escape/secret.txt');
    expect(err).toBe(403);
  });
});
