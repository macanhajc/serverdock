import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../../context/AuthContext';
import { dockerFetch } from './dockerApi';
import { dockerKeys } from './queryKeys';

export interface DockerImage {
  id: string;
  shortId: string;
  tags: string[];
  size: number;
  created: number;
  inUse: boolean;
}

export function useDockerImages() {
  const { token } = useAuth();
  return useQuery({
    queryKey: dockerKeys.images,
    queryFn: () => dockerFetch<DockerImage[]>('/api/docker/images', token),
    enabled: !!token,
  });
}
