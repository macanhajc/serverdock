import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { BackupEntry } from '../../../../types';
import { serverDetailKeys } from './queryKeys';

export function useUpdateRetention(id: string, token: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (keep: number): Promise<{ retention: number; backups: BackupEntry[] }> => {
      const res = await fetch(`/api/backups/${id}/retention`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ keep }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? '');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: serverDetailKeys.backups(id) });
    },
  });
}
