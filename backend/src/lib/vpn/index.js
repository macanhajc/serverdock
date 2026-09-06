import * as netbird from './providers/netbird.js';
import * as tailscale from './providers/tailscale.js';
import * as wireguard from './providers/wireguard.js';
import * as zerotier from './providers/zerotier.js';
import * as manual from './providers/manual.js';
import { getSettings } from '../settingsStore.js';

const PROVIDERS = {
  [netbird.id]: netbird,
  [tailscale.id]: tailscale,
  [wireguard.id]: wireguard,
  [zerotier.id]: zerotier,
  [manual.id]: manual,
};

// Single source of truth for what settings.networkProvider may be set to.
export const PROVIDER_IDS = Object.keys(PROVIDERS);

// Cache the status for 30 seconds to avoid subprocess overhead on every
// request. Keyed by provider id so switching providers in Settings doesn't
// serve stale data left over from whichever provider was active before.
const CACHE_TTL = 30_000;
let cache = null;
let cacheAt = 0;
let cacheProvider = null;

export async function getVpnStatus() {
  const settings = getSettings();
  const provider = PROVIDERS[settings.networkProvider] ?? PROVIDERS.manual;

  const now = Date.now();
  if (cache && cacheProvider === provider.id && now - cacheAt < CACHE_TTL) return cache;

  const status = await provider.getStatus(settings);
  cache = { provider: provider.id, ...status };
  cacheAt = now;
  cacheProvider = provider.id;
  return cache;
}

// Returns the VPN IP of this machine, or null if VPN is not active.
// Used by the server routes to populate connection.host dynamically.
export async function getSelfIp() {
  try {
    const status = await getVpnStatus();
    return status.self?.ip ?? null;
  } catch {
    return null;
  }
}

export function invalidateVpnCache() {
  cache = null;
  cacheAt = 0;
  cacheProvider = null;
}
