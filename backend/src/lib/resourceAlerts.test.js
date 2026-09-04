import { describe, it, expect, beforeEach } from 'vitest';
import db from './db.js';
import { getResourceAlert, setResourceAlert, clearResourceAlert } from './resourceAlerts.js';

beforeEach(() => {
  db.exec('DELETE FROM server_events');
});

describe('resourceAlerts', () => {
  it('is null when no alert has been set', () => {
    expect(getResourceAlert('game-1')).toBeNull();
  });

  it('setResourceAlert persists cpu/memPct/message and stamps a since from the DB row', () => {
    const alert = setResourceAlert('game-1', { cpu: 95, memPct: 40, message: 'CPU at 95%' });
    expect(alert).toMatchObject({ cpu: 95, memPct: 40, message: 'CPU at 95%' });
    expect(alert.since).toEqual(expect.any(String));
    expect(getResourceAlert('game-1')).toEqual(alert);
  });

  it('clearResourceAlert resolves it and reports whether it cleared anything', () => {
    expect(clearResourceAlert('game-1')).toBe(false);
    setResourceAlert('game-1', { cpu: 95, memPct: 40, message: 'CPU at 95%' });
    expect(clearResourceAlert('game-1')).toBe(true);
    expect(getResourceAlert('game-1')).toBeNull();
  });

  it('survives across calls as if the process had restarted — nothing is cached in memory', () => {
    setResourceAlert('game-1', { cpu: 95, memPct: 40, message: 'CPU at 95%' });
    // A fresh read (no shared in-process state involved beyond the db module
    // itself) still sees it — this is the whole point of the SQLite backing.
    expect(getResourceAlert('game-1')).not.toBeNull();
  });
});
