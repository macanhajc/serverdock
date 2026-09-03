import { Router } from 'express';
import { verifyToken } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permissions.js';
import docker from '../lib/docker.js';

const router = Router();

// GET /api/docker/images
router.get('/images', verifyToken, async (req, res) => {
  const images = await docker.listImages({ all: false });
  res.json(
    images.map((img) => ({
      id: img.Id,
      shortId: img.Id.replace('sha256:', '').slice(0, 12),
      tags: img.RepoTags ?? [],
      size: img.Size,
      created: img.Created,
    }))
  );
});

// DELETE /api/docker/images/:id
router.delete(
  '/images/:id',
  verifyToken,
  requirePermission('settings:manage'),
  async (req, res) => {
    try {
      await docker.getImage(req.params.id).remove({ force: true });
      res.json({ message: 'Image removed' });
    } catch (err) {
      if (err.statusCode === 404) return res.status(404).json({ error: 'Image not found' });
      if (err.statusCode === 409)
        return res.status(409).json({ error: err.message ?? 'Image is in use' });
      throw err;
    }
  }
);

// GET /api/docker/containers
router.get('/containers', verifyToken, async (req, res) => {
  const containers = await docker.listContainers({ all: true });
  res.json(
    containers.map((c) => ({
      id: c.Id,
      shortId: c.Id.slice(0, 12),
      names: c.Names.map((n) => n.replace(/^\//, '')),
      image: c.Image,
      state: c.State,
      status: c.Status,
      created: c.Created,
    }))
  );
});

// DELETE /api/docker/containers/:id
router.delete(
  '/containers/:id',
  verifyToken,
  requirePermission('settings:manage'),
  async (req, res) => {
    try {
      await docker.getContainer(req.params.id).remove({ force: true });
      res.json({ message: 'Container removed' });
    } catch (err) {
      if (err.statusCode === 404) return res.status(404).json({ error: 'Container not found' });
      throw err;
    }
  }
);

export default router;
