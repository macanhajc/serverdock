import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../../context/AuthContext';
import type { VpnStatus } from '../../../../types';
import { dashboardFetch } from './dashboardApi';
import { dashboardKeys } from './queryKeys';

// A page-scoped duplicate of NetworkPage's useVpnStatus — same endpoint and
// poll interval, but deliberately its own hook/query key (see queryKeys.ts)
// so this page stays self-contained rather than implicitly sharing cache
// with NetworkPage.
export function useVpnStatus() {
  const { token } = useAuth();
  return useQuery({
    queryKey: dashboardKeys.vpnStatus,
    queryFn: () =>
      dashboardFetch<VpnStatus>('/api/vpn/status', {
        headers: { Authorization: `Bearer ${token}` },
      }),
    enabled: !!token,
    refetchInterval: 30_000,
  });
}
