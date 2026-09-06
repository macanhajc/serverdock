import { describe, it, expect, afterEach } from 'vitest';
import { randomUUID } from 'crypto';
import { setIo } from './socket.js';
import { getLogBuffer, pushLogBuffer, pushSystemLogLine } from './logBuffer.js';

afterEach(() => {
  setIo(null);
});

function fakeId() {
  return `game-${randomUUID()}`;
}

describe('pushLogBuffer / getLogBuffer', () => {
  it('is undefined for a game that has never logged anything', () => {
    expect(getLogBuffer(fakeId())).toBeUndefined();
  });

  it('accumulates entries in insertion order', () => {
    const id = fakeId();
    pushLogBuffer(id, { line: 'first' });
    pushLogBuffer(id, { line: 'second' });
    expect(getLogBuffer(id).map((e) => e.line)).toEqual(['first', 'second']);
  });

  it('caps the buffer at 300 entries, dropping the oldest first', () => {
    const id = fakeId();
    for (let i = 0; i < 305; i++) pushLogBuffer(id, { line: `line-${i}` });
    const buf = getLogBuffer(id);
    expect(buf).toHaveLength(300);
    expect(buf[0].line).toBe('line-5'); // the first 5 were evicted
    expect(buf[299].line).toBe('line-304');
  });
});

describe('pushSystemLogLine', () => {
  it('appends a timestamped entry at the given level', () => {
    const id = fakeId();
    pushSystemLogLine(id, 'Failed to start server: boom', 'error');
    const [entry] = getLogBuffer(id);
    expect(entry).toMatchObject({ line: 'Failed to start server: boom', level: 'error' });
    expect(new Date(entry.ts).toString()).not.toBe('Invalid Date');
  });

  it('defaults to level "error" when none is given', () => {
    const id = fakeId();
    pushSystemLogLine(id, 'something happened');
    expect(getLogBuffer(id)[0].level).toBe('error');
  });

  it('emits the same entry to the logs:<id> room when io is installed', () => {
    const id = fakeId();
    const calls = [];
    setIo({ to: (room) => ({ emit: (event, payload) => calls.push({ room, event, payload }) }) });

    pushSystemLogLine(id, 'restart failed', 'warn');

    expect(calls).toHaveLength(1);
    expect(calls[0].room).toBe(`logs:${id}`);
    expect(calls[0].event).toBe('log:line');
    expect(calls[0].payload).toMatchObject({ id, line: 'restart failed', level: 'warn' });
  });
});
