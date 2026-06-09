// Placeholder — implement when a public IP is available and WireGuard replaces Tailscale.
// Expected interface: export async function getStatus() → { provider, self, peers }
// where self = { name, ip, online } and peers = [{ id, name, ip, online, lastSeen }]

export async function getStatus() {
  return { provider: 'wireguard', self: null, peers: [] };
}

export function invalidateCache() {}
