import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Cache the status for 30 seconds to avoid subprocess overhead on every request
let cache = null;
let cacheAt = 0;
const CACHE_TTL = 30_000;

async function run(cmd) {
  const { stdout } = await execAsync(cmd, { timeout: 5000 });
  return stdout.trim();
}

export async function getStatus() {
  const now = Date.now();
  if (cache && now - cacheAt < CACHE_TTL) return cache;

  try {
    const raw = await run('tailscale status --json');
    const data = JSON.parse(raw);

    const self = {
      name: data.Self?.HostName ?? 'unknown',
      ip: data.Self?.TailscaleIPs?.[0] ?? null,
      online: data.Self?.Online ?? false,
    };

    const peers = Object.values(data.Peer ?? {}).map((p) => ({
      id: p.ID,
      name: p.HostName,
      ip: p.TailscaleIPs?.[0] ?? null,
      os: p.OS ?? null,
      online: p.Online ?? false,
      lastSeen: p.LastSeen ?? null,
    }));

    cache = { provider: 'tailscale', self, peers };
    cacheAt = now;
    return cache;
  } catch {
    // Tailscale not installed or not running
    cache = { provider: 'tailscale', self: null, peers: [] };
    cacheAt = now;
    return cache;
  }
}

export function invalidateCache() {
  cache = null;
  cacheAt = 0;
}
