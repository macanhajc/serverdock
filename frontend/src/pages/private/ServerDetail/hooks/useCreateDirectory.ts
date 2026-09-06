import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useCreateDirectory(id: string, token: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (path: string) => {
      const res = await fetch(`/api/files/${id}/mkdir`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Create failed');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serverDetail', 'files', id] });
    },
  });
}
