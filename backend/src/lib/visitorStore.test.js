import { describe, it, expect, beforeEach } from 'vitest';
import db from './db.js';
import {
  getVisitors,
  getByToken,
  getByUsername,
  getById,
  createVisitor,
  updateVisitor,
  removeVisitor,
} from './visitorStore.js';

beforeEach(() => {
  db.exec('DELETE FROM visitor_ips; DELETE FROM visitors;');
});

describe('createVisitor', () => {
  it('assigns a unique id and token, and records the given ip/userAgent', async () => {
    const visitor = await createVisitor({ username: 'alice', ip: '10.0.0.5', userAgent: 'curl/8' });

    expect(visitor.id).toBeTruthy();
    expect(visitor.token).toBeTruthy();
    expect(visitor.id).not.toBe(visitor.token);
    expect(visitor.username).toBe('alice');
    expect(visitor.ip).toBe('10.0.0.5');
    expect(visitor.firstSeen).toBe(visitor.lastSeen);
  });

  it('is findable by its token and by username (case-insensitively)', async () => {
    const visitor = await createVisitor({ username: 'Bob', ip: '10.0.0.6' });

    expect(getByToken(visitor.token)?.id).toBe(visitor.id);
    expect(getByUsername('bob')?.id).toBe(visitor.id);
    expect(getByUsername('BOB')?.id).toBe(visitor.id);
  });

  it('tolerates a missing ip', async () => {
    const visitor = await createVisitor({ username: 'carol' });
    expect(visitor.ip).toBeNull();
  });
});

describe('updateVisitor', () => {
  it('patches ip and lastSeen, leaving other fields untouched', async () => {
    const visitor = await createVisitor({ username: 'dave', ip: '10.0.0.7' });

    const updated = await updateVisitor(visitor.id, { ip: '10.0.0.8', lastSeen: '2026-02-01T00:00:00Z' });

    expect(updated.ip).toBe('10.0.0.8');
    expect(updated.lastSeen).toBe('2026-02-01T00:00:00Z');
    expect(updated.username).toBe('dave');
    expect(updated.firstSeen).toBe(visitor.firstSeen);
  });

  it('keeps the existing ip when the patch omits it', async () => {
    const visitor = await createVisitor({ username: 'erin', ip: '10.0.0.9' });
    const updated = await updateVisitor(visitor.id, { lastSeen: '2026-02-01T00:00:00Z' });
    expect(updated.ip).toBe('10.0.0.9');
  });

  it('returns null for an unknown visitor id', async () => {
    expect(await updateVisitor('does-not-exist', { ip: '1.2.3.4' })).toBeNull();
  });
});

describe('removeVisitor', () => {
  it('deletes the visitor and reports true', async () => {
    const visitor = await createVisitor({ username: 'frank' });
    expect(await removeVisitor(visitor.id)).toBe(true);
    expect(getById(visitor.id)).toBeNull();
  });

  it('reports false when nothing was deleted', async () => {
    expect(await removeVisitor('does-not-exist')).toBe(false);
  });
});

describe('getVisitors', () => {
  it('lists visitors most-recently-seen first', async () => {
    const a = await createVisitor({ username: 'grace', ip: '10.0.0.1' });
    const b = await createVisitor({ username: 'heidi', ip: '10.0.0.2' });
    await updateVisitor(a.id, { lastSeen: '2026-03-01T00:00:00Z' });
    await updateVisitor(b.id, { lastSeen: '2026-01-01T00:00:00Z' });

    expect(getVisitors().map((v) => v.username)).toEqual(['grace', 'heidi']);
  });
});
