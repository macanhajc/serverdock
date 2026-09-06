import 'dotenv/config';
import { randomBytes } from 'crypto';
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

// Fall back to a generated, persisted JWT_SECRET when the operator hasn't
// supplied one (e.g. a Docker install with no .env) — same generate-once-
// and-reuse pattern as the VAPID keys above. An operator-supplied env var
// always wins and is never touched here.
if (!process.env.JWT_SECRET) {
  const s = getSettings();
  if (!s.generatedJwtSecret) {
    const secret = randomBytes(32).toString('hex');
    await saveSettings({ generatedJwtSecret: secret });
    process.env.JWT_SECRET = secret;
    logger.info('JWT_SECRET not set — generated and persisted one');
  } else {
    process.env.JWT_SECRET = s.generatedJwtSecret;
  }
}

await migrateLegacyData();

await loadGames();
initScheduler(getGames());

const PORT = process.env.PORT ?? 4000;
httpServer.listen(PORT, () => logger.info({ port: PORT }, 'ServerDock backend running'));

// Some container runtimes redeliver SIGTERM repeatedly while waiting for a
// process to exit (observed under Docker Desktop/WSL2) rather than sending
// it once — without this guard, every redelivery re-entered shutdown() and
// re-ran the async container-stop sweep concurrently with itself.
let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
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
