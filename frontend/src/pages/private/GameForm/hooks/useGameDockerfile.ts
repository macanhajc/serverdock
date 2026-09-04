import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../../context/AuthContext';
import { gameFormKeys } from './queryKeys';

export function useGameDockerfile(id: string | undefined, enabled: boolean) {
  const { token } = useAuth();
  return useQuery({
    queryKey: gameFormKeys.dockerfile(id),
    queryFn: async () => {
      const res = await fetch(`/api/games/${id}/dockerfile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      return res.json() as Promise<{ content: string } | null>;
    },
    enabled: enabled && !!id && !!token,
  });
}
