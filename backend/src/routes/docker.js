import { Router } from 'express';
import { verifyToken } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permissions.js';
import docker from '../lib/docker.js';

const router = Router();

// GET /api/docker/summary — daemon version/platform + disk usage breakdown, for the page's top panel.
router.get('/summary', verifyToken, async (req, res) => {
  const [info, df] = await Promise.all([docker.info(), docker.df()]);

  const images = df.Images ?? [];
  const containers = df.Containers ?? [];
  const volumes = df.Volumes ?? [];
  const buildCache = df.BuildCache ?? [];

  // Size fields come back -1/undefined when the daemon hasn't computed them; clamp to 0
  // rather than let a stray -1 silently subtract from the total.
  const sum = (arr, fn) =>
    arr.reduce((a, x) => {
      const v = fn(x);
      return a + (typeof v === 'number' && v > 0 ? v : 0);
    }, 0);

  res.json({
    version: info.ServerVersion,
    os: info.OperatingSystem,
    arch: info.Architecture,
    kernelVersion: info.KernelVersion,
    driver: info.Driver,
    disk: {
      images: {
        count: images.length,
        total: sum(images, (i) => i.Size),
        reclaimable: sum(
          images.filter((i) => (i.Containers ?? 0) <= 0),
          (i) => i.Size
        ),
      },
      containers: {
        count: containers.length,
        total: sum(containers, (c) => c.SizeRw),
        reclaimable: sum(
          containers.filter((c) => c.State !== 'running'),
          (c) => c.SizeRw
        ),
      },
      volumes: {
        count: volumes.length,
        total: sum(volumes, (v) => v.UsageData?.Size),
        reclaimable: sum(
          volumes.filter((v) => (v.UsageData?.RefCount ?? 0) === 0),
          (v) => v.UsageData?.Size
        ),
      },
      buildCache: {
        count: buildCache.length,
        total: sum(buildCache, (b) => b.Size),
        reclaimable: sum(
          buildCache.filter((b) => !b.InUse),
          (b) => b.Size
        ),
      },
    },
  });
});

// GET /api/docker/images
router.get('/images', verifyToken, async (req, res) => {
  const [images, containers] = await Promise.all([
    docker.listImages({ all: false }),
    docker.listContainers({ all: true }),
  ]);
  const usedImageIds = new Set(containers.map((c) => c.ImageID));
  res.json(
    images.map((img) => ({
      id: img.Id,
      shortId: img.Id.replace('sha256:', '').slice(0, 12),
      tags: img.RepoTags ?? [],
      size: img.Size,
      created: img.Created,
      inUse: usedImageIds.has(img.Id),
    }))
  );
});

// GET /api/docker/images/:id — inspect detail for the expand row.
router.get('/images/:id', verifyToken, async (req, res) => {
  try {
    const info = await docker.getImage(req.params.id).inspect();
    res.json({
      id: info.Id,
      architecture: info.Architecture,
      os: info.Os,
      author: info.Author || null,
      comment: info.Comment || null,
      layers: info.RootFS?.Layers?.length ?? 0,
      repoDigests: info.RepoDigests ?? [],
      cmd: info.Config?.Cmd ?? null,
      entrypoint: info.Config?.Entrypoint ?? null,
      exposedPorts: info.Config?.ExposedPorts ? Object.keys(info.Config.ExposedPorts) : [],
    });
  } catch (err) {
    if (err.statusCode === 404) return res.status(404).json({ error: 'Image not found' });
    throw err;
  }
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

// GET /api/docker/containers/:id — inspect detail for the expand row. Env is deliberately
// omitted: games pass secrets (RCON password, etc.) via -e, and this endpoint only needs
// JWT, not console:write.
router.get('/containers/:id', verifyToken, async (req, res) => {
  try {
    const info = await docker.getContainer(req.params.id).inspect();
    const ports = Object.entries(info.NetworkSettings?.Ports ?? {}).map(
      ([containerPort, bindings]) => ({
        containerPort,
        hostBindings: (bindings ?? []).map((b) => ({ hostIp: b.HostIp, hostPort: b.HostPort })),
      })
    );
    const mounts = (info.Mounts ?? []).map((m) => ({
      type: m.Type,
      source: m.Source,
      destination: m.Destination,
      mode: m.Mode,
      rw: m.RW,
    }));
    res.json({
      id: info.Id,
      restartCount: info.RestartCount,
      networkMode: info.HostConfig?.NetworkMode,
      command: [info.Path, ...(info.Args ?? [])].filter(Boolean).join(' '),
      ports,
      mounts,
      state: {
        status: info.State?.Status,
        startedAt: info.State?.StartedAt,
        finishedAt: info.State?.FinishedAt,
        exitCode: info.State?.ExitCode,
        oomKilled: info.State?.OOMKilled,
        error: info.State?.Error || null,
      },
    });
  } catch (err) {
    if (err.statusCode === 404) return res.status(404).json({ error: 'Container not found' });
    throw err;
  }
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
