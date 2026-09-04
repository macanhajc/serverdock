import { useQuery } from '@tanstack/react-query';
import type { Server } from '../../../../types';
import { dashboardFetch } from './dashboardApi';
import { dashboardKeys } from './queryKeys';

// The public list endpoint needs no JWT — matches every other consumer of
// GET /api/servers in the app.
export function useServers() {
  return useQuery({
    queryKey: dashboardKeys.servers,
    queryFn: () => dashboardFetch<Server[]>('/api/servers'),
  });
}
