import { mkdir, rm, writeFile, readFile, readdir, access } from 'fs/promises';
import { join, dirname } from 'path';
import { Router } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { verifyToken } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permissions.js';
import {
  getGames,
  getGame,
  loadGames,
  saveGame,
  GAMES_DIR,
  getDataPath,
} from '../lib/gameLoader.js';
import { getContainerStatus } from '../lib/containers.js';
import { getIo } from '../lib/socket.js';
import { emitServerEvent } from '../lib/statusBus.js';
import docker from '../lib/docker.js';
import { checkImageUpdate } from '../lib/imageUpdates.js';

const router = Router();

const REQUIRED_FIELDS = ['id', 'name', 'imageSource', 'image', 'ports'];

// Fields the config form is allowed to set via PUT. Everything else on a game
// record (avatar, avatarVersion, imageBuilt, schedules, backupRetention, ...)
// is system-managed and must survive a plain config save regardless of what a
// request body happens to contain.
const EDITABLE_FIELDS = [
  'name',
  'description',
  'imageSource',
  'image',
  'storeUrl',
  'dataMount',
  'query',
  'ports',
  'environment',
  'resources',
  'rcon',
];

function pickEditableFields(body) {
  const patch = {};
  for (const f of EDITABLE_FIELDS) {
    if (body[f] !== undefined) patch[f] = body[f];
  }
  return patch;
}

// --- Avatar upload ---

// Cards, the admin table, and the detail header only ever render the avatar
// at up to ~480px — resizing once here means every later page load fetches a
// few-KB file instead of re-downloading whatever the admin originally uploaded.
const AVATAR_MAX_DIMENSION = 480;
const AVATAR_FILENAME = 'avatar.webp';

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
});

// Wraps multer so size/field errors come back as a normal 400 instead of a 500
// from the generic error middleware.
function handleAvatarUpload(req, res, next) {
  avatarUpload.single('avatar')(req, res, (err) => {
    if (err) {
      const message =
        err.code === 'LIMIT_FILE_SIZE' ? 'Image must be 4 MB or smaller' : 'Upload failed';
      return res.status(400).json({ error: message });
    }
    next();
  });
}

// Removes any existing avatar.* file in a game's own folder (not its data/
// volume) — extension may differ from the incoming upload.
async function removeExistingAvatar(gameDir) {
  let entries;
  try {
    entries = await readdir(gameDir);
  } catch {
    return;
  }
  await Promise.all(
    entries.filter((f) => f.startsWith('avatar.')).map((f) => rm(join(gameDir, f), { force: true }))
  );
}

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

async function updateImageBuilt(id, value) {
  await saveGame(id, { imageBuilt: value });
  await loadGames();
}

// Everything next to the Dockerfile except runtime state (data/backups) goes
// into the build context, so a Dockerfile can COPY in local content (mods,
// plugin jars, configs) and not just RUN-fetch things from the internet.
// Docker still honors a .dockerignore in here to trim what actually lands
// inside COPY/ADD destinations.
async function buildContextEntries(id) {
  const entries = await readdir(join(GAMES_DIR, id), { withFileTypes: true });
  return entries.filter((e) => e.name !== 'data' && e.name !== 'backups').map((e) => e.name);
}

async function runBuild(id, imageName) {
  const io = getIo();
  const name = getGame(id)?.name ?? id;

  // Build outcomes also go to the status room so admins who navigated away
  // from the build page still see the result.
  const notifyFailed = (error) => {
    io?.to(`build:${id}`).emit('build:failed', { id, success: false, error });
    emitServerEvent({ type: 'build_failed', id, name, message: error });
  };
  const notifyComplete = () => {
    io?.to(`build:${id}`).emit('build:complete', { id, success: true });
    emitServerEvent({ type: 'build_complete', id, name });
  };

  let buildStream;
  try {
    const src = await buildContextEntries(id);
    buildStream = await docker.buildImage({ context: join(GAMES_DIR, id), src }, { t: imageName });
  } catch (err) {
    notifyFailed(err.message);
    return;
  }

  await new Promise((resolve) => {
    docker.modem.followProgress(
      buildStream,
      async (err) => {
        if (err) {
          notifyFailed(err.message);
          await updateImageBuilt(id, false).catch(() => {});
        } else {
          notifyComplete();
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

// POST /api/games/:id/check-update — live registry digest check, on demand only
// (never scheduled — Docker Hub's anonymous pull-rate limit applies to this too)
router.post('/:id/check-update', verifyToken, async (req, res) => {
  const game = getGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  if (game.imageSource !== 'public') {
    return res.status(400).json({ error: 'Only public images can be checked for updates' });
  }
  res.json(await checkImageUpdate(game.image));
});

// GET /api/games/:id/export — config + Dockerfile as a portable JSON bundle,
// for versioning/migrating server definitions independently of data backups.
// Excludes data/ (that's what backups are for) and the avatar image itself
// (this is JSON-only) along with anything tied to this specific machine.
router.get('/:id/export', verifyToken, async (req, res) => {
  const { id } = req.params;
  const game = getGame(id);
  if (!game) return res.status(404).json({ error: 'Game not found' });

  const {
    avatar: _avatar,
    avatarVersion: _avatarVersion,
    imageBuilt: _imageBuilt,
    ...exportable
  } = game;

  let dockerfile;
  if (game.imageSource === 'local') {
    try {
      dockerfile = await readFile(join(GAMES_DIR, id, 'Dockerfile'), 'utf-8');
    } catch {
      // no Dockerfile saved yet — export without one
    }
  }

  res.setHeader('Content-Disposition', `attachment; filename="${id}.serverdock.json"`);
  res.json({ version: 1, exportedAt: new Date().toISOString(), game: exportable, dockerfile });
});

// POST /api/games/import — creates a new game from a bundle produced by the
// export route above. Same validation as a normal create; rejects if the id
// already exists rather than guessing at a merge.
router.post('/import', verifyToken, requirePermission('games:create'), async (req, res) => {
  const { game, dockerfile } = req.body ?? {};
  if (!game || typeof game !== 'object') {
    return res.status(400).json({ error: 'Missing "game" in import bundle' });
  }

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

  // Strip the same machine-local fields export leaves out, in case an older
  // export or a hand-edited bundle still carries them.
  const {
    avatar: _avatar,
    avatarVersion: _avatarVersion,
    imageBuilt: _imageBuilt,
    ...toWrite
  } = game;

  const gameDir = join(GAMES_DIR, toWrite.id);
  await mkdir(gameDir, { recursive: true });
  await mkdir(getDataPath(toWrite.id), { recursive: true });
  await writeFile(join(gameDir, `${toWrite.id}.json`), JSON.stringify(toWrite, null, 2));

  if (toWrite.imageSource === 'local' && typeof dockerfile === 'string' && dockerfile.trim()) {
    await writeFile(join(gameDir, 'Dockerfile'), dockerfile);
  }

  await loadGames();

  res.status(201).json({ id: toWrite.id, message: 'Game imported' });
});

// POST /api/games
router.post('/', verifyToken, requirePermission('games:create'), async (req, res) => {
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

  const gameDir = join(GAMES_DIR, game.id);
  await mkdir(gameDir, { recursive: true });
  await mkdir(getDataPath(game.id), { recursive: true });
  await writeFile(join(gameDir, `${game.id}.json`), JSON.stringify(game, null, 2));
  await loadGames();

  res.status(201).json({ id: game.id, message: 'Game created' });
});

// PUT /api/games/:id
router.put('/:id', verifyToken, requirePermission('games:edit'), async (req, res) => {
  const { id } = req.params;
  const existing = getGame(id);
  if (!existing) return res.status(404).json({ error: 'Game not found' });

  const patch = pickEditableFields(req.body ?? {});
  const game = { ...existing, ...patch };

  const missing = REQUIRED_FIELDS.filter((f) => game[f] === undefined);
  if (missing.length)
    return res.status(400).json({ error: `Missing fields: ${missing.join(', ')}` });

  const portRangeErr = validatePortRange(game.ports);
  if (portRangeErr) return res.status(400).json({ error: portRangeErr });

  await saveGame(id, patch);
  await loadGames();

  res.json({ message: 'Game updated' });
});

// DELETE /api/games/:id
router.delete('/:id', verifyToken, requirePermission('games:delete'), async (req, res) => {
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

// GET /api/games/:id/dockerfile — raw content of the saved Dockerfile, for
// populating the edit form (which otherwise has no way to know what's on disk).
router.get('/:id/dockerfile', verifyToken, requirePermission('games:edit'), async (req, res) => {
  const { id } = req.params;
  if (!getGame(id)) return res.status(404).json({ error: 'Game not found' });

  try {
    const content = await readFile(join(GAMES_DIR, id, 'Dockerfile'), 'utf-8');
    res.json({ content });
  } catch {
    res.status(404).json({ error: 'Dockerfile not found' });
  }
});

// POST /api/games/:id/dockerfile
router.post('/:id/dockerfile', verifyToken, requirePermission('games:edit'), async (req, res) => {
  const { id } = req.params;
  if (!getGame(id)) return res.status(404).json({ error: 'Game not found' });

  const { content } = req.body ?? {};
  if (!content) return res.status(400).json({ error: 'content is required' });

  await writeFile(join(GAMES_DIR, id, 'Dockerfile'), content);
  res.json({ message: 'Dockerfile saved' });
});

// POST /api/games/:id/avatar
router.post(
  '/:id/avatar',
  verifyToken,
  requirePermission('games:edit'),
  handleAvatarUpload,
  async (req, res) => {
    const { id } = req.params;
    const game = getGame(id);
    if (!game) return res.status(404).json({ error: 'Game not found' });

    const file = req.file;
    if (!file) return res.status(400).json({ error: 'Image file is required' });

    let resized;
    try {
      resized = await sharp(file.buffer)
        .rotate() // normalize orientation using EXIF before stripping it
        .resize({
          width: AVATAR_MAX_DIMENSION,
          height: AVATAR_MAX_DIMENSION,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 82 })
        .toBuffer();
    } catch {
      return res.status(400).json({ error: 'Could not process image — is it a valid image file?' });
    }

    const gameDir = join(GAMES_DIR, id);
    await removeExistingAvatar(gameDir);
    await writeFile(join(gameDir, AVATAR_FILENAME), resized);

    // avatarVersion cache-busts the versioned public URL
    await saveGame(id, { avatar: AVATAR_FILENAME, avatarVersion: Date.now() });
    await loadGames();

    res.json({ avatar: AVATAR_FILENAME });
  }
);

// DELETE /api/games/:id/avatar
router.delete('/:id/avatar', verifyToken, requirePermission('games:edit'), async (req, res) => {
  const { id } = req.params;
  const game = getGame(id);
  if (!game) return res.status(404).json({ error: 'Game not found' });

  const gameDir = join(GAMES_DIR, id);
  await removeExistingAvatar(gameDir);

  // undefined values are dropped by JSON.stringify, so this clears both keys
  await saveGame(id, { avatar: undefined, avatarVersion: undefined });
  await loadGames();

  res.json({ message: 'Avatar removed' });
});

// POST /api/games/:id/build
router.post('/:id/build', verifyToken, requirePermission('games:edit'), async (req, res) => {
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
