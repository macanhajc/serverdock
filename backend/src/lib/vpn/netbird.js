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

// NetBird reports addresses as CIDR (e.g. "100.64.0.1/16") — strip the mask.
function stripCidr(ip) {
  return ip ? ip.split('/')[0] : null;
}

function isConnected(status) {
  return (status ?? '').toLowerCase() === 'connected';
}

export async function getStatus() {
  const now = Date.now();
  if (cache && now - cacheAt < CACHE_TTL) return cache;

  try {
    const raw = await run('netbird status --json');
    const data = JSON.parse(raw);

    // Local peer info is reported at the top level, not under a "localPeerState" key.
    const self = {
      name: data.fqdn ?? 'unknown',
      ip: stripCidr(data.netbirdIp ?? null),
      online: isConnected(data.daemonStatus),
    };

    const details = data.peers?.details ?? [];
    const peers = details.map((p) => ({
      id: p.publicKey,
      name: p.fqdn,
      ip: stripCidr(p.netbirdIp ?? p.ip ?? null),
      os: p.os ?? null,
      online: isConnected(p.status),
      lastSeen: p.lastStatusUpdate ?? null,
    }));

    cache = { provider: 'netbird', self, peers };
    cacheAt = now;
    return cache;
  } catch {
    // NetBird not installed or not running
    cache = { provider: 'netbird', self: null, peers: [] };
    cacheAt = now;
    return cache;
  }
}

export function invalidateCache() {
  cache = null;
  cacheAt = 0;
}
