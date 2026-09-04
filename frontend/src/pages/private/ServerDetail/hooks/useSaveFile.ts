import { useMutation, useQueryClient } from '@tanstack/react-query';

// Also reused for "create new file" (empty content) — same endpoint either way.
export function useSaveFile(id: string, token: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ path, content }: { path: string; content: string }) => {
      const res = await fetch(`/api/files/${id}/write`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, content }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Save failed');
      }
    },
    onSuccess: () => {
      // Only the directory listing (size/modified time) — not the fileContent
      // query itself, which would refetch over whatever the editor currently
      // holds and risk clobbering an in-progress edit made right after saving.
      queryClient.invalidateQueries({ queryKey: ['serverDetail', 'files', id] });
    },
  });
}
