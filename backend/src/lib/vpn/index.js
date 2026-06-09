import * as tailscale from './tailscale.js';
import * as wireguard from './wireguard.js';

function provider() {
  const p = (process.env.VPN_PROVIDER ?? 'tailscale').toLowerCase();
  if (p === 'wireguard') return wireguard;
  return tailscale;
}

export async function getVpnStatus() {
  return provider().getStatus();
}

// Returns the VPN IP of this machine, or null if VPN is not active.
// Used by the server routes to populate connection.host dynamically.
export async function getSelfIp() {
  try {
    const status = await provider().getStatus();
    return status.self?.ip ?? null;
  } catch {
    return null;
  }
}

export function invalidateVpnCache() {
  provider().invalidateCache();
}
