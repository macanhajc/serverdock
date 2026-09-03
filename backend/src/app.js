import os from 'os';
import express from 'express';
import cors from 'cors';
import logger from './lib/logger.js';

import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admins.js';
import serverRoutes from './routes/servers.js';
import pushRoutes from './routes/push.js';
import backupRoutes from './routes/backups.js';
import gameRoutes from './routes/games.js';
import fileRoutes from './routes/files.js';
import visitorRoutes from './routes/visitors.js';
import vpnRoutes from './routes/vpn.js';
import settingsRoutes from './routes/settings.js';
import scheduleRoutes from './routes/schedules.js';
import dockerRoutes from './routes/docker.js';
import { getGames } from './lib/gameLoader.js';
import { isDockerAvailable } from './lib/docker.js';
import { getHostDiskInfo } from './lib/diskUtils.js';

// Builds the Express app (routes + middleware) without starting anything —
// no listen(), no scheduler, no socket.io, no background jobs. Kept separate
// from index.js so tests (supertest) can import just the app.
export function createApp() {
  const app = express();
  const corsOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:5174';

  app.use(cors({ origin: corsOrigin }));
  // 1mb leaves headroom for the file manager's 512 KB edit ceiling plus JSON
  // escaping overhead (express.json defaults to 100kb, which would 413 mid-size edits).
  app.use(express.json({ limit: '1mb' }));

  app.use('/api/auth', authRoutes);
  app.use('/api/admins', adminRoutes);
  app.use('/api/servers', serverRoutes);
  app.use('/api/games', gameRoutes);
  app.use('/api/files', fileRoutes);
  app.use('/api/visitors', visitorRoutes);
  app.use('/api/vpn', vpnRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/schedules', scheduleRoutes);
  app.use('/api/push', pushRoutes);
  app.use('/api/backups', backupRoutes);
  app.use('/api/docker', dockerRoutes);

  app.get('/api/health', async (req, res) => {
    const [dockerStatus, hostDisk] = await Promise.all([
      isDockerAvailable().then((ok) => (ok ? 'connected' : 'unavailable')),
      getHostDiskInfo(),
    ]);
    const cpus = os.cpus();
    res.json({
      status: dockerStatus === 'connected' ? 'ok' : 'degraded',
      docker: dockerStatus,
      games: getGames().length,
      hostTotalMem: os.totalmem(),
      hostCpuCount: cpus.length,
      hostCpuModel: cpus[0]?.model ?? null,
      hostDisk,
      hostOs: {
        type: os.type(),
        release: os.release(),
        arch: os.arch(),
        hostname: os.hostname(),
        uptime: os.uptime(),
      },
    });
  });

  // Express v5 error middleware
  app.use((err, req, res, _next) => {
    logger.error({ err, url: req.url, method: req.method }, 'unhandled error');
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
  });

  return app;
}
