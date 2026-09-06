import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../../context/AuthContext';
import { dockerFetch } from './dockerApi';
import { dockerKeys } from './queryKeys';

export interface DockerContainer {
  id: string;
  shortId: string;
  names: string[];
  image: string;
  state: string;
  status: string;
  created: number;
}

export function useDockerContainers() {
  const { token } = useAuth();
  return useQuery({
    queryKey: dockerKeys.containers,
    queryFn: () => dockerFetch<DockerContainer[]>('/api/docker/containers', token),
    enabled: !!token,
  });
}
