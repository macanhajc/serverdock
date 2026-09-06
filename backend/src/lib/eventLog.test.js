import { describe, it, expect, beforeEach } from 'vitest';
import db from './db.js';
import { recordEvent, getActiveEvent, resolveActiveEvent, listEvents, clearEvents } from './eventLog.js';

beforeEach(() => {
  db.exec('DELETE FROM server_events');
});

describe('recordEvent / getActiveEvent', () => {
  it('returns null when nothing has been recorded', () => {
    expect(getActiveEvent('game-1', 'resource_high')).toBeNull();
  });

  it('records an event and surfaces it as the active one', () => {
    const active = recordEvent('game-1', 'resource_high', { cpu: 95, memPct: 40, message: 'CPU at 95%' });
    expect(active).toMatchObject({
      gameId: 'game-1',
      type: 'resource_high',
      data: { cpu: 95, memPct: 40, message: 'CPU at 95%' },
      resolvedAt: null,
    });
    expect(active.createdAt).toEqual(expect.any(String));
    expect(getActiveEvent('game-1', 'resource_high')).toMatchObject({ id: active.id });
  });

  it('keeps events for different games and types independent', () => {
    recordEvent('game-1', 'resource_high', { cpu: 95 });
    recordEvent('game-1', 'crash', { exitCode: 137, oomKilled: true, error: null });
    recordEvent('game-2', 'resource_high', { cpu: 91 });

    expect(getActiveEvent('game-1', 'resource_high')?.data.cpu).toBe(95);
    expect(getActiveEvent('game-1', 'crash')?.data.oomKilled).toBe(true);
    expect(getActiveEvent('game-2', 'resource_high')?.data.cpu).toBe(91);
    expect(getActiveEvent('game-2', 'crash')).toBeNull();
  });

  it('a second record for the same (game, type) becomes the new active event', () => {
    recordEvent('game-1', 'resource_high', { cpu: 91 });
    const second = recordEvent('game-1', 'resource_high', { cpu: 97 });
    expect(getActiveEvent('game-1', 'resource_high')).toMatchObject({ id: second.id });
  });

  it('a second record does not resolve the first — every distinct occurrence keeps its own row', () => {
    const first = recordEvent('game-1', 'action_failed', { action: 'start', message: 'first' });
    recordEvent('game-1', 'action_failed', { action: 'start', message: 'second' });
    // Both remain unresolved until something explicitly resolves them
    expect(listEvents('game-1').filter((e) => e.resolvedAt === null)).toHaveLength(2);
    expect(listEvents('game-1').find((e) => e.id === first.id)?.resolvedAt).toBeNull();
  });

  it('rejects an unknown type', () => {
    expect(() => recordEvent('game-1', 'not_a_real_type', {})).toThrow(/Unknown server_events type/);
  });
});

describe('resolveActiveEvent', () => {
  it('returns false when there is nothing to resolve', () => {
    expect(resolveActiveEvent('game-1', 'resource_high')).toBe(false);
  });

  it('resolves the open event and clears it from getActiveEvent', () => {
    recordEvent('game-1', 'resource_high', { cpu: 95 });
    expect(resolveActiveEvent('game-1', 'resource_high')).toBe(true);
    expect(getActiveEvent('game-1', 'resource_high')).toBeNull();
  });

  it('only resolves the matching type, leaving others untouched', () => {
    recordEvent('game-1', 'resource_high', { cpu: 95 });
    recordEvent('game-1', 'crash', { exitCode: 1, oomKilled: false, error: null });
    resolveActiveEvent('game-1', 'resource_high');
    expect(getActiveEvent('game-1', 'resource_high')).toBeNull();
    expect(getActiveEvent('game-1', 'crash')).not.toBeNull();
  });

  it('resolves every unresolved row of that type at once, not just the newest', () => {
    recordEvent('game-1', 'action_failed', { action: 'start', message: 'first' });
    recordEvent('game-1', 'action_failed', { action: 'start', message: 'second' });
    expect(resolveActiveEvent('game-1', 'action_failed')).toBe(true);
    expect(listEvents('game-1').every((e) => e.resolvedAt !== null)).toBe(true);
  });
});

describe('listEvents', () => {
  it('returns every event for a game, newest first, resolved or not', () => {
    const first = recordEvent('game-1', 'resource_high', { cpu: 91 });
    resolveActiveEvent('game-1', 'resource_high');
    const second = recordEvent('game-1', 'crash', { exitCode: 137, oomKilled: true, error: null });

    const history = listEvents('game-1');
    expect(history.map((e) => e.id)).toEqual([second.id, first.id]);
    expect(history[1].resolvedAt).toEqual(expect.any(String));
    expect(history[0].resolvedAt).toBeNull();
  });

  it('is bounded per game — the oldest rows are pruned beyond the cap', () => {
    for (let i = 0; i < 55; i++) {
      recordEvent('game-1', 'resource_high', { cpu: i });
      resolveActiveEvent('game-1', 'resource_high');
    }
    const history = listEvents('game-1', 1000);
    expect(history.length).toBe(50);
    // Newest survive — the last recorded cpu value is 54
    expect(history[0].data.cpu).toBe(54);
  });
});

describe('clearEvents', () => {
  it('wipes every row for a game, resolved or not', () => {
    recordEvent('game-1', 'resource_high', { cpu: 91 });
    resolveActiveEvent('game-1', 'resource_high');
    recordEvent('game-1', 'crash', { exitCode: 137, oomKilled: true, error: null });

    clearEvents('game-1');
    expect(listEvents('game-1')).toEqual([]);
    expect(getActiveEvent('game-1', 'crash')).toBeNull();
  });

  it('leaves other games untouched', () => {
    recordEvent('game-1', 'resource_high', { cpu: 91 });
    recordEvent('game-2', 'resource_high', { cpu: 88 });

    clearEvents('game-1');
    expect(listEvents('game-1')).toEqual([]);
    expect(listEvents('game-2')).toHaveLength(1);
  });
});
