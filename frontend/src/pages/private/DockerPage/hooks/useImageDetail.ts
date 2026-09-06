import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../../context/AuthContext';
import { dockerFetch } from './dockerApi';
import { dockerKeys } from './queryKeys';

export interface ImageDetail {
  id: string;
  architecture: string;
  os: string;
  author: string | null;
  comment: string | null;
  layers: number;
  repoDigests: string[];
  cmd: string[] | null;
  entrypoint: string[] | null;
  exposedPorts: string[];
}

// enabled: false until the row is actually expanded — no reason to inspect
// every image up front just because the page loaded.
export function useImageDetail(id: string, enabled: boolean) {
  const { token } = useAuth();
  return useQuery({
    queryKey: dockerKeys.imageDetail(id),
    queryFn: () => dockerFetch<ImageDetail>(`/api/docker/images/${encodeURIComponent(id)}`, token),
    enabled: enabled && !!token,
  });
}
