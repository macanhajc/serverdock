import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../../context/AuthContext';
import { dockerFetch } from './dockerApi';
import { dockerKeys } from './queryKeys';

export interface ContainerDetail {
  id: string;
  restartCount: number;
  networkMode: string;
  command: string;
  ports: { containerPort: string; hostBindings: { hostIp: string; hostPort: string }[] }[];
  mounts: { type: string; source: string; destination: string; mode: string; rw: boolean }[];
  state: {
    status: string;
    startedAt: string;
    finishedAt: string;
    exitCode: number;
    oomKilled: boolean;
    error: string | null;
  };
}

// enabled: false until the row is actually expanded — same reasoning as useImageDetail.
export function useContainerDetail(id: string, enabled: boolean) {
  const { token } = useAuth();
  return useQuery({
    queryKey: dockerKeys.containerDetail(id),
    queryFn: () =>
      dockerFetch<ContainerDetail>(`/api/docker/containers/${encodeURIComponent(id)}`, token),
    enabled: enabled && !!token,
  });
}
