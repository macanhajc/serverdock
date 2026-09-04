import { useQuery } from '@tanstack/react-query';
import type { ScheduleEntry } from '../../../../types';
import { serverDetailKeys } from './queryKeys';

// A failed fetch resolves to an empty list rather than an error state,
// matching the original's silent fallback.
export function useSchedules(id: string, token: string | null) {
  return useQuery({
    queryKey: serverDetailKeys.schedules(id),
    queryFn: async () => {
      const res = await fetch(`/api/schedules/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return [];
      return res.json() as Promise<ScheduleEntry[]>;
    },
  });
}
