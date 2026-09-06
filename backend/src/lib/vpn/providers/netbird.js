import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export const id = 'netbird';
export const label = 'NetBird';

// NetBird reports addresses as CIDR (e.g. "100.64.0.1/16") — strip the mask.
function stripCidr(ip) {
  return ip ? ip.split('/')[0] : null;
}

function isConnected(status) {
  return (status ?? '').toLowerCase() === 'connected';
}

// NetBird marshals time.Duration as plain nanoseconds (no unit suffix).
function normalizeLatency(latencyNs) {
  return typeof latencyNs === 'number' && latencyNs > 0 ? Math.round(latencyNs / 1e6) : null;
}

function normalizeConnType(connectionType) {
  if (connectionType === 'P2P') return 'direct';
  if (connectionType === 'Relayed') return 'relayed';
  return null;
}

export async function getStatus() {
  try {
    const { stdout } = await execFileAsync('netbird', ['status', '--json'], { timeout: 5000 });
    const data = JSON.parse(stdout);

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
      latencyMs: normalizeLatency(p.latency),
      connectionType: normalizeConnType(p.connectionType),
    }));

    return { self, peers };
  } catch {
    // NetBird not installed or not running
    return { self: null, peers: [] };
  }
}
