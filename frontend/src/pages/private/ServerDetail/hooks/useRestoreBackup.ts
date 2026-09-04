import { useMutation } from '@tanstack/react-query';

export function useRestoreBackup(id: string, token: string | null) {
  return useMutation({
    mutationFn: async (backupId: string) => {
      const res = await fetch(`/api/backups/${id}/${backupId}/restore`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? '');
      }
    },
  });
}
