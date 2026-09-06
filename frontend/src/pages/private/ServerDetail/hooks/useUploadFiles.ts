import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useUploadFiles(id: string, token: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ path, files }: { path: string; files: File[] }) => {
      const form = new FormData();
      for (const f of files) form.append('files', f);
      const res = await fetch(`/api/files/${id}/upload?path=${encodeURIComponent(path)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Upload failed');
      return data.uploaded as string[];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serverDetail', 'files', id] });
    },
  });
}
