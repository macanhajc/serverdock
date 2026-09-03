import 'dotenv/config';
import webpush from 'web-push';
import { createServer } from 'http';
import { Server } from 'socket.io';
import logger from './lib/logger.js';
import { createApp } from './app.js';
import { loadGames, getGames } from './lib/gameLoader.js';
import { initScheduler } from './lib/scheduler.js';
import { migrateLegacyData } from './lib/legacyMigration.js';
import { loadSettings, getSettings, saveSettings } from './lib/settingsStore.js';
import docker from './lib/docker.js';
import { setIo } from './lib/socket.js';
import { setupSocketHandlers } from './lib/socketHandlers.js';

const app = createApp();
const httpServer = createServer(app);
const corsOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:5174';

const io = new Server(httpServer, {
  cors: { origin: corsOrigin },
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
