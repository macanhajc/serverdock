import { describe, it, expect, beforeEach } from 'vitest';
import db from './db.js';
import { getLastCrash, setLastCrash, clearLastCrash } from './crashInfo.js';

beforeEach(() => {
  db.exec('DELETE FROM server_events');
});

describe('crashInfo', () => {
  it('is null when nothing has crashed', () => {
    expect(getLastCrash('game-1')).toBeNull();
  });

  it('setLastCrash normalizes getContainerExitInfo()\'s shape and stamps an at from the DB row', () => {
    const crash = setLastCrash('game-1', {
      exitCode: 137,
      oomKilled: true,
      error: null,
      finishedAt: '2026-01-01T00:00:00.000Z',
    });
    // finishedAt isn't part of the persisted shape — at (the detection time) is what's tracked
    expect(crash).toEqual({ exitCode: 137, oomKilled: true, error: null, at: expect.any(String) });
    expect(getLastCrash('game-1')).toEqual(crash);
  });

  it('defaults every field when exitInfo is null (inspect() failed)', () => {
    const crash = setLastCrash('game-1', null);
    expect(crash).toEqual({ exitCode: null, oomKilled: false, error: null, at: expect.any(String) });
  });

  it('clearLastCrash resolves it and reports whether it cleared anything', () => {
    expect(clearLastCrash('game-1')).toBe(false);
    setLastCrash('game-1', { exitCode: 1, oomKilled: false, error: 'boom' });
    expect(clearLastCrash('game-1')).toBe(true);
    expect(getLastCrash('game-1')).toBeNull();
  });
});
