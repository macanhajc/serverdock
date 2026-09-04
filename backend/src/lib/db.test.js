import { describe, it, expect, afterEach, vi } from 'vitest';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { existsSync, rmSync } from 'fs';
import Database from 'better-sqlite3';

// db.js reads DB_PATH at module-eval time and opens the connection as a
// side effect of import — these tests exercise that by pointing it at a
// real temp file (rather than the ':memory:' every other test file uses via
// tests/setup.js) and dynamically re-importing after resetting the module
// registry, so each test controls exactly what's on disk before db.js runs.
describe('server_events schema migration', () => {
  let tempPath;

  afterEach(() => {
    if (tempPath && existsSync(tempPath)) rmSync(tempPath, { force: true });
    process.env.DB_PATH = ':memory:';
  });

  it('rebuilds a pre-existing table that still has the old CHECK constraint, preserving its rows', async () => {
    tempPath = join(tmpdir(), `serverdock-test-db-${randomUUID()}.sqlite`);

    // Simulate an install from before 'action_failed' existed: the original
    // server_events shape, CHECK constraint and all, with one real row in it.
    const seed = new Database(tempPath);
    seed.exec(`
      CREATE TABLE server_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('resource_high', 'crash')),
        data TEXT NOT NULL,
        created_at TEXT NOT NULL,
        resolved_at TEXT
      );
    `);
    seed
      .prepare('INSERT INTO server_events (game_id, type, data, created_at) VALUES (?, ?, ?, ?)')
      .run(
        'humanitz',
        'crash',
        JSON.stringify({ exitCode: 137, oomKilled: false, error: null }),
        '2026-09-03T21:38:52.956Z'
      );
    seed.close();

    process.env.DB_PATH = tempPath;
    vi.resetModules();
    const { default: db } = await import('./db.js');

    // The old constraint is gone — a type it never allowed now inserts fine.
    expect(() =>
      db
        .prepare('INSERT INTO server_events (game_id, type, data, created_at) VALUES (?, ?, ?, ?)')
        .run('humanitz', 'action_failed', '{}', new Date().toISOString())
    ).not.toThrow();

    // The pre-existing row survived the rebuild, untouched.
    const preserved = db.prepare("SELECT * FROM server_events WHERE type = 'crash'").get();
    expect(preserved.game_id).toBe('humanitz');
    expect(JSON.parse(preserved.data)).toEqual({ exitCode: 137, oomKilled: false, error: null });
    expect(preserved.created_at).toBe('2026-09-03T21:38:52.956Z');

    db.close();
  });

  it('a fresh install (no pre-existing table) just gets the current schema, no rebuild needed', async () => {
    tempPath = join(tmpdir(), `serverdock-test-db-${randomUUID()}.sqlite`);

    process.env.DB_PATH = tempPath;
    vi.resetModules();
    const { default: db } = await import('./db.js');

    expect(() =>
      db
        .prepare('INSERT INTO server_events (game_id, type, data, created_at) VALUES (?, ?, ?, ?)')
        .run('game-1', 'action_failed', '{}', new Date().toISOString())
    ).not.toThrow();

    db.close();
  });
});
