import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { BackupEntry } from '../../../../types';
import { serverDetailKeys } from './queryKeys';

export function useCreateBackup(id: string, token: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (label: string): Promise<BackupEntry> => {
      let res: Response;
      try {
        res = await fetch(`/api/backups/${id}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ label: label.trim() || undefined }),
        });
      } catch {
        throw new Error('Could not reach server');
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Backup failed');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: serverDetailKeys.backups(id) });
    },
  });
}
