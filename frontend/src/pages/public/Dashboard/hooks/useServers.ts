import { useQuery } from '@tanstack/react-query';
import type { Server } from '../../../../types';
import { publicDashboardFetch } from './publicDashboardApi';
import { publicDashboardKeys } from './queryKeys';

// Only starts once a visitor is identified — matches the original, which
// never called fetchServers until the identify effect resolved. The 10s
// poll is a deliberate belt-and-suspenders refresh on top of the socket
// sync in useServerSocketSync, not a replacement for it.
export function useServers(enabled: boolean) {
  return useQuery({
    queryKey: publicDashboardKeys.servers,
    queryFn: () => publicDashboardFetch<Server[]>('/api/servers'),
    enabled,
    refetchInterval: 10_000,
  });
}
