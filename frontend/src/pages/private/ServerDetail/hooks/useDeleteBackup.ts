import { useMutation, useQueryClient } from '@tanstack/react-query';
import { serverDetailKeys } from './queryKeys';

export function useDeleteBackup(id: string, token: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (backupId: string) => {
      const res = await fetch(`/api/backups/${id}/${backupId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: serverDetailKeys.backups(id) });
    },
  });
}
