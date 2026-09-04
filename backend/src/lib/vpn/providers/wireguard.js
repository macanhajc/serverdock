import { execFile } from 'child_process';
import { promisify } from 'util';
import { hostname } from 'os';

const execFileAsync = promisify(execFile);

// Guards settings.wireguardInterface before it becomes a process argument —
// execFile already avoids shell interpolation, this is belt-and-suspenders.
const IFACE_PATTERN = /^[a-zA-Z0-9_.-]{1,15}$/;
const HANDSHAKE_STALE_MS = 3 * 60_000;

export const id = 'wireguard';
export const label = 'WireGuard';

function stripCidr(ip) {
  return ip ? ip.split('/')[0] : null;
}

async function getInterfaceIp(iface) {
  try {
    const { stdout } = await execFileAsync('ip', ['-4', '-o', 'addr', 'show', iface], {
      timeout: 5000,
    });
    // e.g. "3: wg0    inet 100.64.0.5/24 brd 100.64.0.255 scope global wg0"
    const match = stdout.match(/inet\s+(\S+)/);
    return match ? stripCidr(match[1]) : null;
  } catch {
    return null;
  }
}

// WireGuard has no built-in peer directory — no names, no OS. Peers are
// identified by a truncated public key, and "online" is inferred from a
// recent handshake rather than a real connection state.
export async function getStatus(settings) {
  const iface = settings?.wireguardInterface || 'wg0';
  if (!IFACE_PATTERN.test(iface)) return { self: null, peers: [] };

  try {
    const [{ stdout }, ip] = await Promise.all([
      execFileAsync('wg', ['show', iface, 'dump'], { timeout: 5000 }),
      getInterfaceIp(iface),
    ]);

    const lines = stdout.trim().split('\n').filter(Boolean);
    if (lines.length === 0) return { self: null, peers: [] };

    const self = { name: hostname(), ip, online: true };

    const now = Date.now();
    // Dump format per peer line: publicKey  presharedKey  endpoint  allowedIps  latestHandshake  rx  tx  keepalive
    const peers = lines.slice(1).map((line) => {
      const [publicKey, , , allowedIps, latestHandshake] = line.split('\t');
      const handshakeMs = Number(latestHandshake) * 1000;
      return {
        id: publicKey,
        name: publicKey ? publicKey.slice(0, 8) : 'unknown',
        ip: stripCidr(allowedIps?.split(',')[0]),
        os: null,
        online: handshakeMs > 0 && now - handshakeMs < HANDSHAKE_STALE_MS,
        lastSeen: handshakeMs > 0 ? new Date(handshakeMs).toISOString() : null,
      };
    });

    return { self, peers };
  } catch {
    // wg not installed, interface missing, or insufficient permissions
    return { self: null, peers: [] };
  }
}
