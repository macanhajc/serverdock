import { useQuery } from '@tanstack/react-query';

export interface PublicSettings {
  registrationOpen: boolean;
}

// A failed/absent response resolves to null rather than an error state — the
// caller treats "unknown" the same as "open" (matching the original's default
// registrationOpen = true until proven otherwise).
export function usePublicSettings(enabled: boolean) {
  return useQuery({
    queryKey: ['auth', 'publicSettings'],
    queryFn: async () => {
      const res = await fetch('/api/settings/public');
      if (!res.ok) return null;
      return res.json() as Promise<PublicSettings>;
    },
    enabled,
  });
}
