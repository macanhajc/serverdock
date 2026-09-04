// Namespaced under 'dashboard' (not 'network'/'servers') so this page's
// query cache entries never silently collide or dedupe with another page's
// hooks of the same shape — see useVpnStatus.ts for why that matters here.
export const dashboardKeys = {
  servers: ['dashboard', 'servers'] as const,
  health: ['dashboard', 'health'] as const,
  vpnStatus: ['dashboard', 'vpnStatus'] as const,
};
