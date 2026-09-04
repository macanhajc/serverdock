import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useRemoveEntry(id: string, token: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (path: string) => {
      const res = await fetch(`/api/files/${id}/delete`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Remove failed');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serverDetail', 'files', id] });
    },
  });
}
