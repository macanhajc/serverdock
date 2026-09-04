import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import db from './lib/db.js';
import { createAdmin } from './lib/adminStore.js';
import { createVisitor } from './lib/visitorStore.js';
import { isIpBlocked } from './lib/blocklistStore.js';

// This suite verifies the wiring, not the business logic underneath it: that
// each mutating route actually has verifyToken + requirePermission/
// requireSuperAdmin attached, and attached to the *right* permission. Unit
// tests elsewhere (adminStore, containers, backupManager, ...) already cover
// what the handlers do once past the gate.
//
// Only docker.js and gameLoader.js are mocked. gameLoader defaults to "no
// games loaded" (getGame -> null), which makes every id-scoped route 404
// immediately after its gate — a reliable, side-effect-free signal that the
// request got past auth/permission checks without ever reaching Docker or
// the filesystem. docker.js is mocked defensively for the couple of routes
// (routes/docker.js) that touch it without going through gameLoader first.
const { dockerMock, gameLoaderMock } = vi.hoisted(() => ({
  dockerMock: {
    listContainers: vi.fn(),
    listImages: vi.fn(),
    getContainer: vi.fn(),
    getImage: vi.fn(),
    createContainer: vi.fn(),
    pull: vi.fn(),
    run: vi.fn(),
    buildImage: vi.fn(),
    modem: { followProgress: vi.fn() },
  },
  gameLoaderMock: {
    getGames: vi.fn(),
    getGame: vi.fn(),
    loadGames: vi.fn(),
    saveGame: vi.fn(),
    getDataPath: vi.fn(),
    getDataRoot: vi.fn(),
    GAMES_DIR: 'C:/mock/games',
  },
}));

vi.mock('./lib/docker.js', () => ({
  default: dockerMock,
  isDockerAvailable: vi.fn().mockResolvedValue(true),
  dockerEndpoint: 'mock',
}));
vi.mock('./lib/gameLoader.js', () => gameLoaderMock);

const { createApp } = await import('./app.js');
const app = createApp();

const containerHandle = { remove: vi.fn() };
const imageHandle = { remove: vi.fn() };

beforeEach(() => {
  db.exec(
    'DELETE FROM admin_permissions; DELETE FROM admins; DELETE FROM visitors; DELETE FROM visitor_ips; DELETE FROM blocked_ips;'
  );
  vi.clearAllMocks();

  gameLoaderMock.getGames.mockReturnValue([]);
  gameLoaderMock.getGame.mockReturnValue(null);
  gameLoaderMock.loadGames.mockResolvedValue([]);
  gameLoaderMock.saveGame.mockResolvedValue(undefined);
  gameLoaderMock.getDataPath.mockImplementation((id) => `C:/mock/games/${id}/data`);
  gameLoaderMock.getDataRoot.mockReturnValue('C:/mock/games');

  dockerMock.listContainers.mockResolvedValue([]);
  dockerMock.listImages.mockResolvedValue([]);
  containerHandle.remove.mockResolvedValue(undefined);
  imageHandle.remove.mockResolvedValue(undefined);
  dockerMock.getContainer.mockReturnValue(containerHandle);
  dockerMock.getImage.mockReturnValue(imageHandle);
});

async function makeAdmin({ role = 'admin', permissions = [] } = {}) {
  const admin = await createAdmin({
    username: `u-${randomUUID()}`,
    password: 'hunter22',
    role,
    permissions,
  });
  const token = jwt.sign(
    { sub: admin.id, username: admin.username, role: admin.role, jti: randomUUID() },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
  return { admin, token };
}

function bearer(token) {
  return { Authorization: `Bearer ${token}` };
}

// Generic "is this route actually gated?" check, reused across routers.
// Deliberately asserts "not 401/403" rather than a specific success status —
// the exact status past the gate (404 game-not-found, 400 bad body, ...) is
// the handler's business, already covered by other tests; this suite only
// cares whether the gate is present and wired to the right permission.
function permissionGateTests({ method, url, permission, body = {} }) {
  it('rejects with 401 when no token is given', async () => {
    const res = await request(app)[method](url).send(body);
    expect(res.status).toBe(401);
  });

  it(`rejects with 403 when the admin lacks ${permission}`, async () => {
    const { token } = await makeAdmin({ permissions: [] });
    const res = await request(app)[method](url).set(bearer(token)).send(body);
    expect(res.status).toBe(403);
  });

  it(`passes the gate once ${permission} is granted`, async () => {
    const { token } = await makeAdmin({ permissions: [permission] });
    const res = await request(app)[method](url).set(bearer(token)).send(body);
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it('a super_admin always passes the gate regardless of explicit grants', async () => {
    const { token } = await makeAdmin({ role: 'super_admin' });
    const res = await request(app)[method](url).set(bearer(token)).send(body);
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });
}

describe('GET /api/health', () => {
  it('responds without auth', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.docker).toBe('connected');
  });
});

describe('servers.js', () => {
  describe('POST /:id/start (servers:power)', () => {
    permissionGateTests({ method: 'post', url: '/api/servers/nonexistent/start', permission: 'servers:power' });
  });
  describe('POST /:id/stop (servers:power)', () => {
    permissionGateTests({ method: 'post', url: '/api/servers/nonexistent/stop', permission: 'servers:power' });
  });
  describe('POST /:id/restart (servers:power)', () => {
    permissionGateTests({ method: 'post', url: '/api/servers/nonexistent/restart', permission: 'servers:power' });
  });
  describe('POST /:id/rcon (console:write)', () => {
    permissionGateTests({
      method: 'post',
      url: '/api/servers/nonexistent/rcon',
      permission: 'console:write',
      body: { command: 'help' },
    });
  });
  describe('POST /:id/reset (servers:reset)', () => {
    permissionGateTests({
      method: 'post',
      url: '/api/servers/nonexistent/reset',
      permission: 'servers:reset',
      body: { confirm: true },
    });
  });
  describe('GET /:id/events (auth only, no specific permission)', () => {
    it('rejects with 401 when no token is given', async () => {
      const res = await request(app).get('/api/servers/nonexistent/events');
      expect(res.status).toBe(401);
    });

    it('any authenticated admin passes, regardless of granted permissions', async () => {
      const { token } = await makeAdmin({ permissions: [] });
      const res = await request(app).get('/api/servers/nonexistent/events').set(bearer(token));
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });
  });
});

describe('games.js', () => {
  describe('POST / (games:create)', () => {
    permissionGateTests({ method: 'post', url: '/api/games', permission: 'games:create' });
  });
  describe('POST /import (games:create)', () => {
    permissionGateTests({ method: 'post', url: '/api/games/import', permission: 'games:create' });
  });
  describe('PUT /:id (games:edit)', () => {
    permissionGateTests({ method: 'put', url: '/api/games/nonexistent', permission: 'games:edit' });
  });
  describe('DELETE /:id (games:delete)', () => {
    permissionGateTests({ method: 'delete', url: '/api/games/nonexistent', permission: 'games:delete' });
  });
  describe('POST /:id/dockerfile (games:edit)', () => {
    permissionGateTests({
      method: 'post',
      url: '/api/games/nonexistent/dockerfile',
      permission: 'games:edit',
      body: { content: 'FROM alpine' },
    });
  });
  describe('DELETE /:id/avatar (games:edit)', () => {
    permissionGateTests({ method: 'delete', url: '/api/games/nonexistent/avatar', permission: 'games:edit' });
  });
  describe('POST /:id/build (games:edit)', () => {
    permissionGateTests({ method: 'post', url: '/api/games/nonexistent/build', permission: 'games:edit' });
  });
});

describe('files.js', () => {
  describe('PUT /:id/write (files:write, +requireStopped)', () => {
    permissionGateTests({
      method: 'put',
      url: '/api/files/nonexistent/write',
      permission: 'files:write',
      body: { path: 'a.txt', content: 'hi' },
    });
  });
  describe('POST /:id/mkdir (files:write)', () => {
    permissionGateTests({
      method: 'post',
      url: '/api/files/nonexistent/mkdir',
      permission: 'files:write',
      body: { path: 'newdir' },
    });
  });
  describe('DELETE /:id/delete (files:write)', () => {
    permissionGateTests({
      method: 'delete',
      url: '/api/files/nonexistent/delete',
      permission: 'files:write',
      body: { path: 'a.txt' },
    });
  });
  describe('PATCH /:id/rename (files:write)', () => {
    permissionGateTests({
      method: 'patch',
      url: '/api/files/nonexistent/rename',
      permission: 'files:write',
      body: { path: 'a.txt', newName: 'b.txt' },
    });
  });
});

describe('backups.js', () => {
  describe('PUT /:id/retention (backups:manage)', () => {
    permissionGateTests({
      method: 'put',
      url: '/api/backups/nonexistent/retention',
      permission: 'backups:manage',
      body: { keep: 5 },
    });
  });
  describe('POST /:id (backups:manage)', () => {
    permissionGateTests({ method: 'post', url: '/api/backups/nonexistent', permission: 'backups:manage' });
  });
  describe('POST /:id/:backupId/restore (backups:manage)', () => {
    permissionGateTests({
      method: 'post',
      url: `/api/backups/nonexistent/${randomUUID()}/restore`,
      permission: 'backups:manage',
    });
  });
  describe('DELETE /:id/:backupId (backups:manage)', () => {
    permissionGateTests({
      method: 'delete',
      url: `/api/backups/nonexistent/${randomUUID()}`,
      permission: 'backups:manage',
    });
  });
});

describe('routes/docker.js', () => {
  describe('DELETE /images/:id (settings:manage)', () => {
    permissionGateTests({ method: 'delete', url: '/api/docker/images/abc123', permission: 'settings:manage' });
  });
  describe('DELETE /containers/:id (settings:manage)', () => {
    permissionGateTests({ method: 'delete', url: '/api/docker/containers/abc123', permission: 'settings:manage' });
  });

  it('actually calls through to Docker once the gate is passed', async () => {
    const { token } = await makeAdmin({ permissions: ['settings:manage'] });
    const res = await request(app).delete('/api/docker/images/abc123').set(bearer(token));
    expect(res.status).toBe(200);
    expect(dockerMock.getImage).toHaveBeenCalledWith('abc123');
    expect(imageHandle.remove).toHaveBeenCalledOnce();
  });
});

describe('schedules.js', () => {
  describe('POST /:id (schedules:manage)', () => {
    permissionGateTests({
      method: 'post',
      url: '/api/schedules/nonexistent',
      permission: 'schedules:manage',
      body: { label: 'x', action: 'restart', cron: '0 3 * * *' },
    });
  });
  describe('PUT /:id/:scheduleId (schedules:manage)', () => {
    permissionGateTests({
      method: 'put',
      url: '/api/schedules/nonexistent/sched1',
      permission: 'schedules:manage',
    });
  });
  describe('POST /:id/:scheduleId/run (schedules:manage)', () => {
    permissionGateTests({
      method: 'post',
      url: '/api/schedules/nonexistent/sched1/run',
      permission: 'schedules:manage',
    });
  });
  describe('DELETE /:id/:scheduleId (schedules:manage)', () => {
    permissionGateTests({
      method: 'delete',
      url: '/api/schedules/nonexistent/sched1',
      permission: 'schedules:manage',
    });
  });

  // CLAUDE.md: "A command-type schedule additionally requires console:write on
  // top of schedules:manage, since a scheduled command has the same effect as
  // console access." — this needs a game that actually exists, so getGame is
  // pointed at a fake one just for this block.
  describe('a command-action schedule needs console:write on top of schedules:manage', () => {
    const fakeGame = { id: 'mygame', name: 'mygame', schedules: [] };

    beforeEach(() => {
      gameLoaderMock.getGame.mockReturnValue(fakeGame);
    });

    it('403s with schedules:manage alone', async () => {
      const { token } = await makeAdmin({ permissions: ['schedules:manage'] });
      const res = await request(app)
        .post('/api/schedules/mygame')
        .set(bearer(token))
        .send({ label: 'nightly say', action: 'command', command: 'say hi', cron: '0 3 * * *' });

      expect(res.status).toBe(403);
      expect(gameLoaderMock.saveGame).not.toHaveBeenCalled();
    });

    it('succeeds once console:write is also granted', async () => {
      const { token } = await makeAdmin({ permissions: ['schedules:manage', 'console:write'] });
      const res = await request(app)
        .post('/api/schedules/mygame')
        .set(bearer(token))
        .send({
          label: 'nightly say',
          action: 'command',
          command: 'say hi',
          cron: '0 3 * * *',
          enabled: false, // keep node-cron from actually starting the task
        });

      expect(res.status).toBe(201);
      expect(gameLoaderMock.saveGame).toHaveBeenCalledWith(
        'mygame',
        expect.objectContaining({
          schedules: expect.arrayContaining([expect.objectContaining({ action: 'command', command: 'say hi' })]),
        })
      );
    });

    it('a non-command action only needs schedules:manage', async () => {
      const { token } = await makeAdmin({ permissions: ['schedules:manage'] });
      const res = await request(app)
        .post('/api/schedules/mygame')
        .set(bearer(token))
        .send({ label: 'nightly restart', action: 'restart', cron: '0 3 * * *', enabled: false });

      expect(res.status).toBe(201);
    });

    it('a super_admin can create a command schedule without any explicit grant', async () => {
      const { token } = await makeAdmin({ role: 'super_admin' });
      const res = await request(app)
        .post('/api/schedules/mygame')
        .set(bearer(token))
        .send({ label: 'nightly say', action: 'command', command: 'say hi', cron: '0 3 * * *', enabled: false });

      expect(res.status).toBe(201);
    });
  });
});

describe('admins.js', () => {
  it('401s POST /api/admins without a token', async () => {
    const res = await request(app).post('/api/admins').send({ username: 'newbie', password: 'hunter22' });
    expect(res.status).toBe(401);
  });

  it('403s POST /api/admins for a non-super_admin (this is requireSuperAdmin, not a grantable permission)', async () => {
    const { token } = await makeAdmin({ role: 'admin', permissions: [] });
    const res = await request(app)
      .post('/api/admins')
      .set(bearer(token))
      .send({ username: 'newbie', password: 'hunter22' });
    expect(res.status).toBe(403);
  });

  it('lets a super_admin create a new admin end-to-end', async () => {
    const { token } = await makeAdmin({ role: 'super_admin' });
    const res = await request(app)
      .post('/api/admins')
      .set(bearer(token))
      .send({ username: 'newbie', password: 'hunter22', role: 'admin', permissions: ['servers:power'] });

    expect(res.status).toBe(201);
    expect(res.body.username).toBe('newbie');
    expect(res.body.permissions).toEqual(['servers:power']);
  });

  it('refuses to let an admin delete their own account', async () => {
    const { token, admin } = await makeAdmin({ role: 'super_admin' });
    const res = await request(app).delete(`/api/admins/${admin.id}`).set(bearer(token));
    expect(res.status).toBe(400);
  });

  it('refuses to demote the sole super_admin (would leave zero)', async () => {
    const { token, admin } = await makeAdmin({ role: 'super_admin' });
    const res = await request(app).patch(`/api/admins/${admin.id}`).set(bearer(token)).send({ role: 'admin' });
    expect(res.status).toBe(409);
  });
});

describe('visitors.js', () => {
  it('401s GET /api/visitors without a token', async () => {
    const res = await request(app).get('/api/visitors');
    expect(res.status).toBe(401);
  });

  it('403s a block mutation for an admin without visitors:manage', async () => {
    const { token } = await makeAdmin({ permissions: [] });
    const res = await request(app).patch('/api/visitors/some-id/block').set(bearer(token));
    expect(res.status).toBe(403);
  });

  it('lets an admin with visitors:manage block and unblock a real visitor end-to-end', async () => {
    const visitor = await createVisitor({ username: 'guest1', ip: '10.1.2.3' });
    const { token } = await makeAdmin({ permissions: ['visitors:manage'] });

    const blockRes = await request(app).patch(`/api/visitors/${visitor.id}/block`).set(bearer(token));
    expect(blockRes.status).toBe(200);
    expect(isIpBlocked('10.1.2.3')).toBe(true);

    const unblockRes = await request(app).patch(`/api/visitors/${visitor.id}/unblock`).set(bearer(token));
    expect(unblockRes.status).toBe(200);
    expect(isIpBlocked('10.1.2.3')).toBe(false);
  });
});

describe('settings.js', () => {
  it('401s PUT /api/settings without a token', async () => {
    const res = await request(app).put('/api/settings').send({ registrationOpen: false });
    expect(res.status).toBe(401);
  });

  it('403s PUT /api/settings for an admin without settings:manage', async () => {
    const { token } = await makeAdmin({ permissions: [] });
    const res = await request(app).put('/api/settings').set(bearer(token)).send({ registrationOpen: false });
    expect(res.status).toBe(403);
  });

  it('lets an admin with settings:manage actually persist a setting', async () => {
    const { token } = await makeAdmin({ permissions: ['settings:manage'] });
    const putRes = await request(app)
      .put('/api/settings')
      .set(bearer(token))
      .send({ registrationOpen: false });
    expect(putRes.status).toBe(200);
    expect(putRes.body.registrationOpen).toBe(false);

    const getRes = await request(app).get('/api/settings/public');
    expect(getRes.body.registrationOpen).toBe(false);
  });

  it('403s POST /api/settings/wipe-all for an admin without settings:manage', async () => {
    const { token } = await makeAdmin({ permissions: [] });
    const res = await request(app).post('/api/settings/wipe-all').set(bearer(token)).send({ confirm: true });
    expect(res.status).toBe(403);
  });

  it('allows wipe-all once granted (no games loaded here, so nothing to wipe)', async () => {
    const { token } = await makeAdmin({ permissions: ['settings:manage'] });
    const res = await request(app).post('/api/settings/wipe-all').set(bearer(token)).send({ confirm: true });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ wiped: 0 });
  });
});
