import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../../context/AuthContext';
import type { Visitor } from '../../../../types';
import { visitorsFetch } from './visitorsApi';
import { visitorKeys } from './queryKeys';

export function useVisitors() {
  const { token } = useAuth();
  return useQuery({
    queryKey: visitorKeys.list,
    queryFn: () => visitorsFetch<Visitor[]>('/api/visitors', token),
    enabled: !!token,
  });
}
