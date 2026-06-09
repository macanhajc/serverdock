import { mkdir, rm, writeFile, readFile, access } from 'fs/promises';
import { join, dirname } from 'path';
import { Router } from 'express';
import { verifyToken } from '../middleware/auth.js';
import { getGames, getGame, loadGames, GAMES_DIR, getDataPath } from '../lib/gameLoader.js';
import { getContainerStatus } from '../lib/containers.js';
import { getIo } from '../lib/socket.js';
import docker from '../lib/docker.js';

const router = Router();

const REQUIRED_FIELDS = ['id', 'name', 'imageSource', 'image', 'ports'];

function validateId(id) {
  return /^[a-z0-9-]+$/.test(id);
}

function validatePortRange(ports) {
  for (const p of ports) {
    if (!Number.isInteger(p.host) || p.host < 1 || p.host > 65535) {
      return `Invalid host port: ${p.host} — must be 1–65535`;
    }
  }
  return null;
}

function checkPortConflict(game, excludeId = null) {
  const incoming = new Set(game.ports.map((p) => `${p.host}/${p.protocol}`));
  for (const existing of getGames()) {
    if (existing.id === excludeId) continue;
    for (const p of existing.ports) {
      if (incoming.has(`${p.host}/${p.protocol}`)) {
        return `Port ${p.host}/${p.protocol} is already used by "${existing.name}" — change the Host Port to a free one (the Container Port can stay the same)`;
      }
    }
  }
  return null;
}

async function updateImageBuilt(id, value) {
  const jsonPath = join(GAMES_DIR, id, `${id}.json`);
  const game = JSON.parse(await readFile(jsonPath, 'utf-8'));
  game.imageBuilt = value;
  await writeFile(jsonPath, JSON.stringify(game, null, 2));
  await loadGames();
}

async function runBuild(id, imageName) {
  const io = getIo();
  let buildStream;
  try {
    buildStream = await docker.buildImage(
      { context: join(GAMES_DIR, id), src: ['Dockerfile'] },
      { t: imageName }
    );
  } catch (err) {
    io?.to(`build:${id}`).emit('build:failed', { id, success: false, error: err.message });
    return;
  }

  await new Promise((resolve) => {
    docker.modem.followProgress(
      buildStream,
      async (err) => {
        if (err) {
          io?.to(`build:${id}`).emit('build:failed', { id, success: false, error: err.message });
          await updateImageBuilt(id, false).catch(() => {});
        } else {
          io?.to(`build:${id}`).emit('build:complete', { id, success: true });
          await updateImageBuilt(id, true).catch(() => {});
        }
        resolve();
      },
      (event) => {
        const line = event.stream?.trimEnd();
        if (line) io?.to(`build:${id}`).emit('build:line', { id, line });
      }
    );
  });
}

// GET /api/games
router.get('/', verifyToken, async (req, res) => {
  res.json(getGames());
});

// GET /api/games/:id
router.get('/:id', verifyToken, async (req, res) => {
  const game = getGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  res.json(game);
});

// POST /api/games
router.post('/', verifyToken, async (req, res) => {
  const game = req.body ?? {};

  const missing = REQUIRED_FIELDS.filter((f) => game[f] === undefined);
  if (missing.length)
    return res.status(400).json({ error: `Missing fields: ${missing.join(', ')}` });

  if (!validateId(game.id)) {
    return res
      .status(400)
      .json({ error: 'id must be lowercase letters, numbers, and hyphens only' });
  }

  if (getGame(game.id))
    return res.status(409).json({ error: 'A game with this id already exists' });

  const portRangeErr = validatePortRange(game.ports);
  if (portRangeErr) return res.status(400).json({ error: portRangeErr });

  const conflict = checkPortConflict(game);
  if (conflict) return res.status(409).json({ error: conflict });

  const gameDir = join(GAMES_DIR, game.id);
  await mkdir(gameDir, { recursive: true });
  await mkdir(getDataPath(game.id), { recursive: true });
  await writeFile(join(gameDir, `${game.id}.json`), JSON.stringify(game, null, 2));
  await loadGames();

  res.status(201).json({ id: game.id, message: 'Game created' });
});

// PUT /api/games/:id
router.put('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  if (!getGame(id)) return res.status(404).json({ error: 'Game not found' });

  const game = { ...req.body, id };

  const missing = REQUIRED_FIELDS.filter((f) => game[f] === undefined);
  if (missing.length)
    return res.status(400).json({ error: `Missing fields: ${missing.join(', ')}` });

  const portRangeErr = validatePortRange(game.ports);
  if (portRangeErr) return res.status(400).json({ error: portRangeErr });

  const conflict = checkPortConflict(game, id);
  if (conflict) return res.status(409).json({ error: conflict });

  await writeFile(join(GAMES_DIR, id, `${id}.json`), JSON.stringify(game, null, 2));
  await loadGames();

  res.json({ message: 'Game updated' });
});

// DELETE /api/games/:id
router.delete('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  if (!getGame(id)) return res.status(404).json({ error: 'Game not found' });

  const status = await getContainerStatus(id);
  if (status === 'running') {
    return res.status(409).json({ error: 'Stop the server before deleting the game' });
  }

  // Remove the Docker container if it exists (B3 — prevent orphaned containers)
  try {
    await docker.getContainer(`serverdock-${id}`).remove();
  } catch (e) {
    if (e.statusCode !== 404) throw e;
  }

  await rm(join(GAMES_DIR, id), { recursive: true, force: true });

  // Also remove the data directory, which may be on a separate drive when a
  // custom dataRoot is configured. When dataRoot equals GAMES_DIR the parent
  // folder was already removed above; force:true makes the extra rm a no-op.
  const dataParent = dirname(getDataPath(id)); // <dataRoot>/<id>/
  await rm(dataParent, { recursive: true, force: true });

  await loadGames();

  res.json({ message: 'Game deleted' });
});

// POST /api/games/:id/dockerfile
router.post('/:id/dockerfile', verifyToken, async (req, res) => {
  const { id } = req.params;
  if (!getGame(id)) return res.status(404).json({ error: 'Game not found' });

  const { content } = req.body ?? {};
  if (!content) return res.status(400).json({ error: 'content is required' });

  await writeFile(join(GAMES_DIR, id, 'Dockerfile'), content);
  res.json({ message: 'Dockerfile saved' });
});

// POST /api/games/:id/build
router.post('/:id/build', verifyToken, async (req, res) => {
  const { id } = req.params;
  const game = getGame(id);
  if (!game) return res.status(404).json({ error: 'Game not found' });

  if (game.imageSource !== 'local') {
    return res.status(400).json({ error: 'Only local image games can be built' });
  }

  try {
    await access(join(GAMES_DIR, id, 'Dockerfile'));
  } catch {
    return res.status(404).json({ error: 'Dockerfile not found — upload it first' });
  }

  res.json({ message: 'Build started' });

  runBuild(id, game.image).catch(() => {});
});

export default router;
