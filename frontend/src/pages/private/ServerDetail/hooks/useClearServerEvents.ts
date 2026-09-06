import { useMutation, useQueryClient } from '@tanstack/react-query';
import { serverDetailKeys } from './queryKeys';

export function useClearServerEvents(id: string, token: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/servers/${id}/events`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
    },
    onSuccess: () => {
      queryClient.setQueryData(serverDetailKeys.events(id), []);
    },
  });
}
