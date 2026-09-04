import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../../context/AuthContext';
import type { VpnStatus } from '../../../../types';
import { vpnFetch } from './networkApi';
import { networkKeys } from './queryKeys';

export function useVpnStatus() {
  const { token } = useAuth();
  return useQuery({
    queryKey: networkKeys.status,
    queryFn: () => vpnFetch<VpnStatus>('/api/vpn/status', token),
    enabled: !!token,
    refetchInterval: 30_000,
  });
}
