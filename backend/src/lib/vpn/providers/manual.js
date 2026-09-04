export const id = 'manual';
export const label = 'Manual';

// The explicit "I'm not using a mesh VPN" choice — no peer directory, no
// self IP. resolveHost() falls back to settings.serverHost on its own.
export async function getStatus() {
  return { self: null, peers: [] };
}
