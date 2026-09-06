import { useQuery } from '@tanstack/react-query';
import type { FileEntry } from '../../../../types';
import { serverDetailKeys } from './queryKeys';

export function useDirectoryListing(id: string, token: string | null, path: string) {
  return useQuery({
    queryKey: serverDetailKeys.files(id, path),
    queryFn: async () => {
      const res = await fetch(`/api/files/${id}?path=${encodeURIComponent(path)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { entries: FileEntry[] };
      return data.entries;
    },
  });
}
