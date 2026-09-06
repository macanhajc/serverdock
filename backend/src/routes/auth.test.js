import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import db from '../lib/db.js';
import { createAdmin, countAdmins } from '../lib/adminStore.js';

const { createApp } = await import('../app.js');
const app = createApp();

beforeEach(() => {
  db.exec('DELETE FROM admin_permissions; DELETE FROM admins;');
});

describe('GET /api/auth/setup-status', () => {
  it('reports needsSetup: true when no admins exist', async () => {
    const res = await request(app).get('/api/auth/setup-status');
    expect(res.status).toBe(200);
    expect(res.body.needsSetup).toBe(true);
  });

  it('reports needsSetup: false once an admin exists', async () => {
    await createAdmin({ username: 'existing', password: 'hunter22', role: 'super_admin' });
    const res = await request(app).get('/api/auth/setup-status');
    expect(res.body.needsSetup).toBe(false);
  });
});

describe('POST /api/auth/setup', () => {
  it('creates the first admin as super_admin and returns a token', async () => {
    const res = await request(app)
      .post('/api/auth/setup')
      .send({ username: 'first-admin', password: 'hunter22' });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(countAdmins()).toBe(1);

    const row = db.prepare('SELECT * FROM admins WHERE username = ?').get('first-admin');
    expect(row.role).toBe('super_admin');
  });

  it('rejects a short username', async () => {
    const res = await request(app).post('/api/auth/setup').send({ username: 'ab', password: 'hunter22' });
    expect(res.status).toBe(400);
    expect(countAdmins()).toBe(0);
  });

  it('rejects a short password', async () => {
    const res = await request(app).post('/api/auth/setup').send({ username: 'first-admin', password: 'short' });
    expect(res.status).toBe(400);
    expect(countAdmins()).toBe(0);
  });

  it('refuses a second call once setup has completed', async () => {
    await request(app).post('/api/auth/setup').send({ username: 'first-admin', password: 'hunter22' });

    const res = await request(app)
      .post('/api/auth/setup')
      .send({ username: 'second-admin', password: 'hunter22' });

    expect(res.status).toBe(409);
    expect(countAdmins()).toBe(1);
  });

  it('lets only one of two concurrent setup calls succeed', async () => {
    const [a, b] = await Promise.all([
      request(app).post('/api/auth/setup').send({ username: 'admin-a', password: 'hunter22' }),
      request(app).post('/api/auth/setup').send({ username: 'admin-b', password: 'hunter22' }),
    ]);

    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([201, 409]);
    expect(countAdmins()).toBe(1);
  });
});
