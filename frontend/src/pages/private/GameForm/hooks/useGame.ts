import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../../context/AuthContext';
import { gameFormKeys } from './queryKeys';

export interface GameRecord {
  name: string;
  id: string;
  description?: string;
  imageSource?: string;
  image?: string;
  dataMount?: string;
  storeUrl?: string;
  avatar?: string;
  avatarVersion?: number;
  query?: { type?: string; port?: number };
  ports?: { host: number; container: number; protocol: string }[];
  environment?: { key: string; value: string; pinned?: boolean }[];
  resources?: { cpuLimit?: number | null; memoryLimit?: number | null };
  rcon?: {
    enabled?: boolean;
    port?: number;
    password?: string;
    listCommand?: string;
    commands?: { broadcast?: string };
  };
}

export function useGame(id: string | undefined, enabled: boolean) {
  const { token } = useAuth();
  return useQuery({
    queryKey: gameFormKeys.game(id),
    queryFn: async () => {
      const res = await fetch(`/api/games/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      return res.json() as Promise<GameRecord>;
    },
    enabled: enabled && !!id && !!token,
  });
}
