import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../../context/AuthContext';
import type { BlockedIp } from '../../../../types';
import { visitorsFetch } from './visitorsApi';
import { visitorKeys } from './queryKeys';

export function useBlockedIps() {
  const { token } = useAuth();
  return useQuery({
    queryKey: visitorKeys.blocklist,
    queryFn: () => visitorsFetch<BlockedIp[]>('/api/visitors/blocklist', token),
    enabled: !!token,
  });
}
