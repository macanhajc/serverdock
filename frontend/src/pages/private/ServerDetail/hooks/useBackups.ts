import { useQuery } from '@tanstack/react-query';
import type { BackupEntry } from '../../../../types';
import { serverDetailKeys } from './queryKeys';

export interface BackupsResponse {
  backups: BackupEntry[];
  retention: number;
}

// A failed fetch resolves to an empty list (retention 0) rather than an
// error state, matching the original's silent fallback.
export function useBackups(id: string, token: string | null) {
  return useQuery({
    queryKey: serverDetailKeys.backups(id),
    queryFn: async (): Promise<BackupsResponse> => {
      const res = await fetch(`/api/backups/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return { backups: [], retention: 0 };
      return res.json();
    },
  });
}
