import 'dotenv/config';
import os from 'os';
import webpush from 'web-push';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
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
import { loadGames, getGames } from './lib/gameLoader.js';
import { initScheduler } from './lib/scheduler.js';
import { migrateLegacyData } from './lib/legacyMigration.js';
import { loadSettings, getSettings, saveSettings } from './lib/settingsStore.js';
import { isDockerAvailable } from './lib/docker.js';
import docker from './lib/docker.js';
import { getHostDiskInfo } from './lib/diskUtils.js';
import { setIo } from './lib/socket.js';
import { setupSocketHandlers } from './lib/socketHandlers.js';

const app = express();
const httpServer = createServer(app);
const corsOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:5174';

const io = new Server(httpServer, {
  cors: { origin: corsOrigin },
});

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

setIo(io);
setupSocketHandlers(io);

await loadSettings();

// Generate VAPID keys once and persist them
{
  const s = getSettings();
  if (!s.vapidPublicKey || !s.vapidPrivateKey) {
    const keys = webpush.generateVAPIDKeys();
    await saveSettings({ vapidPublicKey: keys.publicKey, vapidPrivateKey: keys.privateKey });
    logger.info('VAPID keys generated');
  }
}

await migrateLegacyData();

await loadGames();
initScheduler(getGames());

const PORT = process.env.PORT ?? 4000;
httpServer.listen(PORT, () => logger.info({ port: PORT }, 'ServerDock backend running'));

async function shutdown(signal) {
  logger.info({ signal }, 'shutdown received — stopping all serverdock containers');
  try {
    const containers = await docker.listContainers({ all: false });
    const managed = containers.filter((c) => c.Names.some((n) => n.startsWith('/serverdock-')));
    await Promise.allSettled(managed.map((c) => docker.getContainer(c.Id).stop()));
    logger.info({ count: managed.length }, 'containers stopped');
  } catch (err) {
    logger.error({ err }, 'error stopping containers');
  }
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
