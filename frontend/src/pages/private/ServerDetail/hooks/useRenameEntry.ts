import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useRenameEntry(id: string, token: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ path, newName }: { path: string; newName: string }) => {
      const res = await fetch(`/api/files/${id}/rename`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, newName }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Rename failed');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serverDetail', 'files', id] });
    },
  });
}
