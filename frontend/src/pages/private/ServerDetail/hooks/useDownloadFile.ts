import { useMutation } from '@tanstack/react-query';

export function useDownloadFile(id: string, token: string | null) {
  return useMutation({
    mutationFn: async ({ path, filename }: { path: string; filename: string }) => {
      const res = await fetch(`/api/files/${id}/download?path=${encodeURIComponent(path)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    },
  });
}
