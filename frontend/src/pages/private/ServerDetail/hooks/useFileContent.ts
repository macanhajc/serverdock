import { useQuery } from '@tanstack/react-query';
import { serverDetailKeys } from './queryKeys';

export function useFileContent(id: string, token: string | null, path: string | undefined) {
  return useQuery({
    queryKey: serverDetailKeys.fileContent(id, path),
    queryFn: async () => {
      const res = await fetch(`/api/files/${id}/read?path=${encodeURIComponent(path!)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Read failed');
      }
      const data = (await res.json()) as { content: string };
      return data.content;
    },
    enabled: !!path,
  });
}
