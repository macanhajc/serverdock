import { createReadStream } from 'fs';
import { readdir, stat, readFile, writeFile, rename, realpath, open, rm, mkdir } from 'fs/promises';
import { join, dirname, basename, resolve as resolvePath } from 'path';
import { Router } from 'express';
import multer from 'multer';
import { verifyToken } from '../middleware/auth.js';
import { getGame, getDataPath } from '../lib/gameLoader.js';
import { getEffectiveStatus } from '../lib/containers.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
});

const router = Router();
const MAX_FILE_SIZE = 512 * 1024; // 512 KB

// --- Path sandbox helpers ---

function withinSandbox(root, p) {
  return p === root || p.startsWith(root + '/');
}

// Resolve clientPath against sandboxRoot using pure path math (no FS access).
// Returns the resolved absolute path, or null if it escapes the sandbox.
function sandboxResolve(root, clientPath) {
  const p = resolvePath(root, (clientPath ?? '').replace(/^\/+/, ''));
  return withinSandbox(root, p) ? p : null;
}

// Resolve + follow symlinks. Returns { real } or { err: 403|404 }.
async function sandboxRealpath(root, clientPath) {
  const preliminary = sandboxResolve(root, clientPath);
  if (!preliminary) return { err: 403 };
  let real;
  try {
    real = await realpath(preliminary);
  } catch {
    return { err: 404 };
  }
  return withinSandbox(root, real) ? { real } : { err: 403 };
}

// File mutations are only allowed while the server is not running — a live
// container may hold files open or overwrite them mid-edit. Reads/listing/
// downloads stay available in any state. `getEffectiveStatus` also covers the
// transient lifecycle states (starting/stopping/pulling/...), none of which are
// editable. Used as middleware so uploads are rejected before multer buffers.
const EDITABLE_STATES = new Set(['stopped', 'not_created', 'error']);

async function requireStopped(req, res, next) {
  const game = getGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  const status = await getEffectiveStatus(game.id);
  if (!EDITABLE_STATES.has(status)) {
    return res.status(409).json({ error: 'Stop the server before changing its files' });
  }
  next();
}

// --- Routes ---

// GET /api/files/:id?path=<relative>
router.get('/:id', verifyToken, async (req, res) => {
  const game = getGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });

  const root = getDataPath(game.id);
  const { real, err } = await sandboxRealpath(root, req.query.path ?? '/');
  if (err === 403) return res.status(403).json({ error: 'Path not allowed' });
  if (err === 404) return res.status(404).json({ error: 'Path not found' });

  let entries;
  try {
    entries = await readdir(real, { withFileTypes: true });
  } catch {
    return res.status(400).json({ error: 'Not a directory' });
  }

  const listed = await Promise.all(
    entries.map(async (entry) => {
      const isDir = entry.isDirectory();
      let size = null;
      let modified = null;
      try {
        const s = await stat(join(real, entry.name));
        size = isDir ? null : s.size;
        modified = s.mtime.toISOString();
      } catch {
        /* skip */
      }
      return { name: entry.name, type: isDir ? 'directory' : 'file', size, modified };
    })
  );

  // Directories first, then files — both alphabetical
  listed.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  res.json({ path: req.query.path ?? '/', entries: listed });
});

// GET /api/files/:id/read?path=<file>
router.get('/:id/read', verifyToken, async (req, res) => {
  const game = getGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });

  const clientPath = req.query.path;
  if (!clientPath) return res.status(400).json({ error: 'path is required' });

  const root = getDataPath(game.id);
  const { real, err } = await sandboxRealpath(root, clientPath);
  if (err === 403) return res.status(403).json({ error: 'Path not allowed' });
  if (err === 404) return res.status(404).json({ error: 'File not found' });

  let fileStat;
  try {
    fileStat = await stat(real);
  } catch {
    return res.status(404).json({ error: 'File not found' });
  }
  if (!fileStat.isFile()) return res.status(400).json({ error: 'Not a file' });
  if (fileStat.size > MAX_FILE_SIZE) {
    return res.status(400).json({ error: 'File too large to edit (max 512 KB)' });
  }

  // Binary detection — read first 512 bytes
  const fd = await open(real, 'r');
  try {
    const buf = Buffer.alloc(512);
    const { bytesRead } = await fd.read(buf, 0, 512, 0);
    if (buf.subarray(0, bytesRead).includes(0x00)) {
      return res.status(400).json({ error: 'Binary file — cannot be edited in the browser' });
    }
  } finally {
    await fd.close();
  }

  const content = await readFile(real, 'utf-8');
  res.json({ path: clientPath, content });
});

// GET /api/files/:id/download?path=<file>
router.get('/:id/download', verifyToken, async (req, res) => {
  const game = getGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });

  const clientPath = req.query.path;
  if (!clientPath) return res.status(400).json({ error: 'path is required' });

  const root = getDataPath(game.id);
  const { real, err } = await sandboxRealpath(root, clientPath);
  if (err === 403) return res.status(403).json({ error: 'Path not allowed' });
  if (err === 404) return res.status(404).json({ error: 'File not found' });

  let fileStat;
  try {
    fileStat = await stat(real);
  } catch {
    return res.status(404).json({ error: 'File not found' });
  }
  if (!fileStat.isFile()) return res.status(400).json({ error: 'Not a file' });

  const filename = basename(real).replace(/["\\]/g, '_');
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Length', fileStat.size);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const stream = createReadStream(real);
  stream.on('error', () => {
    if (!res.headersSent) res.status(500).json({ error: 'Read failed' });
    else res.destroy();
  });
  stream.pipe(res);
});

// POST /api/files/:id/mkdir
router.post('/:id/mkdir', verifyToken, requireStopped, async (req, res) => {
  const game = getGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });

  const clientPath = req.body?.path;
  if (!clientPath) return res.status(400).json({ error: 'path is required' });

  const root = getDataPath(game.id);
  const resolved = sandboxResolve(root, clientPath);
  if (!resolved) return res.status(403).json({ error: 'Path not allowed' });

  await mkdir(resolved, { recursive: true });
  res.status(201).json({ message: 'Folder created' });
});

// POST /api/files/:id/upload?path=<dir>
router.post('/:id/upload', verifyToken, requireStopped, upload.array('files'), async (req, res) => {
  const game = getGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });

  const root = getDataPath(game.id);
  const resolved = sandboxResolve(root, req.query.path ?? '/');
  if (!resolved) return res.status(403).json({ error: 'Path not allowed' });

  const files = req.files ?? [];
  if (!files.length) return res.status(400).json({ error: 'No files provided' });

  const results = [];
  for (const file of files) {
    const safeName = file.originalname.replace(/[/\\]/g, '_');
    const target = join(resolved, safeName);
    if (!withinSandbox(root, target)) {
      results.push({ name: safeName, error: 'Path not allowed' });
      continue;
    }
    await writeFile(target, file.buffer);
    results.push({ name: safeName, size: file.size });
  }

  res.json({ uploaded: results });
});

// PUT /api/files/:id/write
router.put('/:id/write', verifyToken, requireStopped, async (req, res) => {
  const game = getGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });

  const { path: clientPath, content } = req.body ?? {};
  if (!clientPath) return res.status(400).json({ error: 'path is required' });
  if (content === undefined) return res.status(400).json({ error: 'content is required' });

  // For write, the file may not exist yet — pure path math only, no realpath
  const root = getDataPath(game.id);
  const resolved = sandboxResolve(root, clientPath);
  if (!resolved) return res.status(403).json({ error: 'Path not allowed' });

  const tmp = resolved + '.tmp';
  await writeFile(tmp, content, 'utf-8');
  await rename(tmp, resolved);

  res.json({ message: 'File saved' });
});

// PATCH /api/files/:id/rename
router.patch('/:id/rename', verifyToken, requireStopped, async (req, res) => {
  const game = getGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });

  const { path: clientPath, newName } = req.body ?? {};
  if (!clientPath) return res.status(400).json({ error: 'path is required' });
  if (!newName?.trim()) return res.status(400).json({ error: 'newName is required' });

  const safeName = newName.trim();
  if (safeName.includes('/') || safeName.includes('\\')) {
    return res.status(400).json({ error: 'Name cannot contain path separators' });
  }

  const root = getDataPath(game.id);
  const { real, err } = await sandboxRealpath(root, clientPath);
  if (err === 403) return res.status(403).json({ error: 'Path not allowed' });
  if (err === 404) return res.status(404).json({ error: 'Path not found' });

  const target = join(dirname(real), safeName);
  if (!withinSandbox(root, target)) return res.status(403).json({ error: 'Path not allowed' });

  await rename(real, target);
  res.json({ message: 'Renamed' });
});

// DELETE /api/files/:id/delete
router.delete('/:id/delete', verifyToken, requireStopped, async (req, res) => {
  const game = getGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });

  const clientPath = req.body?.path;
  if (!clientPath) return res.status(400).json({ error: 'path is required' });

  const root = getDataPath(game.id);
  const { real, err } = await sandboxRealpath(root, clientPath);
  if (err === 403) return res.status(403).json({ error: 'Path not allowed' });
  if (err === 404) return res.status(404).json({ error: 'Path not found' });

  await rm(real, { recursive: true, force: true });
  res.json({ message: 'Deleted' });
});

export default router;
