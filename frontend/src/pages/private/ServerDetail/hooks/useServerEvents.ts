import { useQuery } from '@tanstack/react-query';
import type { ServerEventEntry } from '../../../../types';
import { serverDetailKeys } from './queryKeys';

// Bounded, append-only history of past resource/crash alerts for this game
// (see backend/src/lib/eventLog.js) — separate from the live banners on the
// page, which only reflect the *current* unresolved condition. A failed
// fetch resolves to an empty list rather than an error state, matching the
// original's silent fallback.
export function useServerEvents(id: string, token: string | null) {
  return useQuery({
    queryKey: serverDetailKeys.events(id),
    queryFn: async () => {
      const res = await fetch(`/api/servers/${id}/events`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return [];
      return res.json() as Promise<ServerEventEntry[]>;
    },
  });
}
