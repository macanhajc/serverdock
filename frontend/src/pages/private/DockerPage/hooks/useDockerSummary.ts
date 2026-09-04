import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../../context/AuthContext';
import { dockerFetch } from './dockerApi';
import { dockerKeys } from './queryKeys';

export interface DockerDiskCategory {
  count: number;
  total: number;
  reclaimable: number;
}

export interface DockerSummary {
  version: string;
  os: string;
  arch: string;
  kernelVersion: string;
  driver: string;
  disk: {
    images: DockerDiskCategory;
    containers: DockerDiskCategory;
    volumes: DockerDiskCategory;
    buildCache: DockerDiskCategory;
  };
}

export function useDockerSummary() {
  const { token } = useAuth();
  return useQuery({
    queryKey: dockerKeys.summary,
    queryFn: () => dockerFetch<DockerSummary>('/api/docker/summary', token),
    enabled: !!token,
  });
}
