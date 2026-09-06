import { useQuery } from '@tanstack/react-query';
import type { HostDisk } from '../../../../types';
import { dashboardFetch } from './dashboardApi';
import { dashboardKeys } from './queryKeys';

export interface HostOs {
  type: string;
  release: string;
  arch: string;
  hostname: string;
  uptime: number;
}

export interface HostHealth {
  hostTotalMem?: number;
  hostCpuCount?: number;
  hostCpuModel?: string;
  hostDisk?: HostDisk;
  hostOs?: HostOs;
}

export function useHostHealth() {
  return useQuery({
    queryKey: dashboardKeys.health,
    queryFn: () => dashboardFetch<HostHealth>('/api/health'),
  });
}
