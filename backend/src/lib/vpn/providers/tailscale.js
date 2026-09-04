import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export const id = 'tailscale';
export const label = 'Tailscale';

// CurAddr is only populated for a direct (hole-punched) path; a peer with
// no direct path but a DERP region assigned is being relayed through it.
// True round-trip latency isn't in `status --json` — getting it would mean
// an extra `tailscale ping` subprocess per peer, so it's left out.
function connectionType(p) {
  if (p.CurAddr) return 'direct';
  if (p.Relay) return 'relayed';
  return null;
}

export async function getStatus() {
  try {
    const { stdout } = await execFileAsync('tailscale', ['status', '--json'], { timeout: 5000 });
    const data = JSON.parse(stdout);

    const selfPeer = data.Self ?? null;
    const self = selfPeer
      ? {
          name: selfPeer.HostName ?? selfPeer.DNSName ?? 'unknown',
          ip: selfPeer.TailscaleIPs?.[0] ?? null,
          online: selfPeer.Online ?? true,
        }
      : null;

    const peers = Object.values(data.Peer ?? {}).map((p) => ({
      id: p.ID ?? p.PublicKey,
      name: p.HostName ?? p.DNSName ?? 'unknown',
      ip: p.TailscaleIPs?.[0] ?? null,
      os: p.OS ?? null,
      online: !!p.Online,
      lastSeen: p.LastSeen ?? null,
      connectionType: connectionType(p),
    }));

    return { self, peers };
  } catch {
    // Tailscale not installed or not running
    return { self: null, peers: [] };
  }
}
