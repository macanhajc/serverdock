import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../../context/AuthContext';
import { gameFormKeys } from './queryKeys';

export interface OtherGame {
  id: string;
  name: string;
  ports?: Array<{ host: number; protocol: string }>;
}

// Used for the port-conflict hint on each PortRow — a failed fetch just
// means no conflicts get flagged, not a page-level error.
export function useOtherGames() {
  const { token } = useAuth();
  return useQuery({
    queryKey: gameFormKeys.otherGames,
    queryFn: async () => {
      const res = await fetch('/api/games', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return [];
      return res.json() as Promise<OtherGame[]>;
    },
    enabled: !!token,
  });
}
