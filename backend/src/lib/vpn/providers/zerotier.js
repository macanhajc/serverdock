import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export const id = 'zerotier';
export const label = 'ZeroTier';

async function runJson(args) {
  const { stdout } = await execFileAsync('zerotier-cli', args, { timeout: 5000 });
  return JSON.parse(stdout);
}

// listpeers reports latency (ms) at the peer level, not per-path — it's
// negative/meaningless for a peer with no active path.
function normalizeLatency(latency) {
  return typeof latency === 'number' && latency >= 0 ? latency : null;
}

// ZeroTier has no local concept of friendly peer names (that lives on the
// My.ZeroTier.com controller, out of scope here) — peers are identified by
// their ZeroTier address, and OS is never available.
export async function getStatus() {
  try {
    const [status, networks, peers] = await Promise.all([
      runJson(['-j', 'status']),
      runJson(['-j', 'listnetworks']).catch(() => []),
      runJson(['-j', 'listpeers']).catch(() => []),
    ]);

    const firstAssignedIp =
      (networks ?? [])
        .flatMap((n) => n.assignedAddresses ?? [])
        .map((cidr) => cidr.split('/')[0])[0] ?? null;

    const self = {
      name: status.address ?? 'unknown',
      ip: firstAssignedIp,
      online: !!status.online,
    };

    const mapped = (peers ?? []).map((p) => {
      const activePath = (p.paths ?? []).find((path) => path.active);
      return {
        id: p.address,
        name: p.address,
        ip: activePath?.address ? activePath.address.split('/')[0] : null,
        os: null,
        online: !!activePath,
        lastSeen: activePath?.lastReceive ? new Date(activePath.lastReceive).toISOString() : null,
        latencyMs: normalizeLatency(p.latency),
      };
    });

    return { self, peers: mapped };
  } catch {
    // zerotier-cli not installed, service not running, or authtoken unreadable
    return { self: null, peers: [] };
  }
}
