import { useQuery } from '@tanstack/react-query';
import type { NetworkProviderId } from '../../../../types';
import { publicDashboardKeys } from './queryKeys';

interface PublicSettings {
  networkProvider: NetworkProviderId | null;
}

// A failed/absent response resolves to null rather than an error state — the
// "how to connect" walkthrough only has NetBird-specific steps written so
// far, so an unknown provider just hides the banner, same as the original.
export function useNetworkProvider() {
  return useQuery({
    queryKey: publicDashboardKeys.networkProvider,
    queryFn: async () => {
      const res = await fetch('/api/settings/public');
      if (!res.ok) return null;
      return res.json() as Promise<PublicSettings>;
    },
  });
}
