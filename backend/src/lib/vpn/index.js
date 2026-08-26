import * as netbird from './netbird.js';

export async function getVpnStatus() {
  return netbird.getStatus();
}

// Returns the VPN IP of this machine, or null if VPN is not active.
// Used by the server routes to populate connection.host dynamically.
export async function getSelfIp() {
  try {
    const status = await netbird.getStatus();
    return status.self?.ip ?? null;
  } catch {
    return null;
  }
}

export function invalidateVpnCache() {
  netbird.invalidateCache();
}
