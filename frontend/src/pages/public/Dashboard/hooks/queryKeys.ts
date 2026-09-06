// Namespaced under 'publicDashboard' so this page's cache entries never
// collide with the admin Dashboard's own 'dashboard'-namespaced servers query
// (same GET /api/servers endpoint, deliberately duplicated per page).
export const publicDashboardKeys = {
  servers: ['publicDashboard', 'servers'] as const,
  networkProvider: ['publicDashboard', 'networkProvider'] as const,
};
