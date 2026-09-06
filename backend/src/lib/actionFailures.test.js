import { describe, it, expect, beforeEach } from 'vitest';
import db from './db.js';
import { getActionFailure, setActionFailure, clearActionFailure } from './actionFailures.js';

beforeEach(() => {
  db.exec('DELETE FROM server_events');
});

describe('actionFailures', () => {
  it('is null when nothing has failed', () => {
    expect(getActionFailure('game-1')).toBeNull();
  });

  it('setActionFailure persists the action, message, and stack, stamping an at from the DB row', () => {
    const err = new Error('No such image: garbage:latest');
    const failure = setActionFailure('game-1', 'start', err);
    expect(failure).toMatchObject({
      action: 'start',
      message: 'No such image: garbage:latest',
      stack: expect.stringContaining('Error: No such image'),
    });
    expect(failure.at).toEqual(expect.any(String));
    expect(getActionFailure('game-1')).toEqual(failure);
  });

  it('truncates an overly long message and stack rather than storing them unbounded', () => {
    const err = new Error('x'.repeat(5000));
    err.stack = 'y'.repeat(10000);
    const failure = setActionFailure('game-1', 'restart', err);
    expect(failure.message.length).toBe(1000);
    expect(failure.stack.length).toBe(4000);
  });

  it('handles a missing stack (non-Error thrown) without crashing', () => {
    const failure = setActionFailure('game-1', 'start', { message: 'boom' });
    expect(failure).toMatchObject({ action: 'start', message: 'boom', stack: null });
  });

  it('every distinct attempt gets its own row — a second failure does not overwrite the first', () => {
    setActionFailure('game-1', 'start', new Error('first failure'));
    setActionFailure('game-1', 'start', new Error('second failure'));
    // getActionFailure only surfaces the newest as "current" ...
    expect(getActionFailure('game-1')?.message).toBe('second failure');
  });

  it('clearActionFailure resolves it and reports whether it cleared anything', () => {
    expect(clearActionFailure('game-1')).toBe(false);
    setActionFailure('game-1', 'start', new Error('boom'));
    expect(clearActionFailure('game-1')).toBe(true);
    expect(getActionFailure('game-1')).toBeNull();
  });
});
