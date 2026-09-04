import { useQuery } from '@tanstack/react-query';
import type { Server } from '../../../../types';
import { serverDetailFetch } from './serverDetailApi';
import { serverDetailKeys } from './queryKeys';

export function useServer(id: string | undefined, token: string | null) {
  return useQuery({
    queryKey: serverDetailKeys.server(id),
    queryFn: () => serverDetailFetch<Server>(`/api/servers/${id}`, token),
    enabled: !!id,
  });
}
