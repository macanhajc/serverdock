import { describe, it, expect, afterEach } from 'vitest';
import { randomUUID } from 'crypto';
import { setIo } from './socket.js';
import {
  markAdminStop,
  clearAdminStop,
  consumeAdminStop,
  hasAdminStop,
  getLastKnown,
  setLastKnown,
  getTransient,
  setTransient,
  settleTransient,
  emitStatus,
  emitPullProgress,
  emitServerEvent,
  emitCrashAlert,
  emitDockerStatus,
  emitDiskStatus,
  emitPlayers,
} from './statusBus.js';

afterEach(() => {
  setIo(null);
});

function fakeId() {
  return `game-${randomUUID()}`;
}

function fakeIo() {
  const calls = [];
  return {
    calls,
    io: {
      to: (room) => ({
        emit: (event, payload) => calls.push({ room, event, payload }),
      }),
    },
  };
}

describe('admin-stop marks', () => {
  it('tracks whether a stop was admin-initiated', () => {
    const id = fakeId();
    expect(hasAdminStop(id)).toBe(false);
    markAdminStop(id);
    expect(hasAdminStop(id)).toBe(true);
    clearAdminStop(id);
    expect(hasAdminStop(id)).toBe(false);
  });

  it('consumeAdminStop reports the mark once, then clears it', () => {
    const id = fakeId();
    markAdminStop(id);
    expect(consumeAdminStop(id)).toBe(true);
    expect(consumeAdminStop(id)).toBe(false);
    expect(hasAdminStop(id)).toBe(false);
  });
});

describe('lastKnown', () => {
  it('is undefined until set', () => {
    expect(getLastKnown(fakeId())).toBeUndefined();
  });

  it('round-trips through setLastKnown/getLastKnown', () => {
    const id = fakeId();
    setLastKnown(id, 'running');
    expect(getLastKnown(id)).toBe('running');
  });
});

describe('transient state', () => {
  it('is null until set', () => {
    expect(getTransient(fakeId())).toBeNull();
  });

  it('setTransient records the transient state and mirrors it into lastKnown', () => {
    const id = fakeId();
    setTransient(id, 'starting');
    expect(getTransient(id)).toBe('starting');
    expect(getLastKnown(id)).toBe('starting');
  });

  it('settleTransient clears the transient state and applies the final status', () => {
    const id = fakeId();
    setTransient(id, 'starting');
    settleTransient(id, 'running');
    expect(getTransient(id)).toBeNull();
    expect(getLastKnown(id)).toBe('running');
  });

  it('settleTransient with no final status clears transient without touching lastKnown', () => {
    const id = fakeId();
    setTransient(id, 'stopping');
    setLastKnown(id, 'running'); // simulate a value already on record
    settleTransient(id, undefined);
    expect(getTransient(id)).toBeNull();
    expect(getLastKnown(id)).toBe('running');
  });
});

describe('emit* helpers', () => {
  it('never throw when no socket.io server has been installed yet', () => {
    const id = fakeId();
    expect(() => {
      emitStatus(id, 'running');
      emitPullProgress(id, { phase: 'downloading', percent: 50 });
      emitServerEvent({ type: 'action_failed', id });
      emitCrashAlert({ id });
      emitDockerStatus(true);
      emitDiskStatus({ low: false });
      emitPlayers(id, 3, 'raw list');
    }).not.toThrow();
  });

  it('emitStatus still updates lastKnown even with no io installed', () => {
    const id = fakeId();
    emitStatus(id, 'stopped');
    expect(getLastKnown(id)).toBe('stopped');
  });

  it('broadcasts every event to the "status" room with the expected shape once io is installed', () => {
    const id = fakeId();
    const { io, calls } = fakeIo();
    setIo(io);

    emitStatus(id, 'running');
    emitPullProgress(id, { phase: 'extracting', percent: 80 });
    emitServerEvent({ type: 'schedule_executed', id, action: 'restart' });
    emitCrashAlert({ id, status: 'error' });
    emitDockerStatus(false);
    emitDiskStatus({ low: true });
    emitPlayers(id, 5, 'Alice\nBob');

    expect(calls).toEqual([
      { room: 'status', event: 'status:update', payload: { id, status: 'running', players: null } },
      { room: 'status', event: 'pull:progress', payload: { id, phase: 'extracting', percent: 80 } },
      {
        room: 'status',
        event: 'server:event',
        payload: { type: 'schedule_executed', id, action: 'restart' },
      },
      { room: 'status', event: 'crash:alert', payload: { id, status: 'error' } },
      { room: 'status', event: 'docker:status', payload: { available: false } },
      { room: 'status', event: 'disk:status', payload: { low: true } },
      { room: 'status', event: 'players:update', payload: { id, players: 5, playerList: 'Alice\nBob' } },
    ]);
  });
});
