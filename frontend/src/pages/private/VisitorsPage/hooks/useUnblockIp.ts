import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../../context/AuthContext';
import { visitorsFetch } from './visitorsApi';
import { visitorKeys } from './queryKeys';

export function useUnblockIp() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ip: string) =>
      visitorsFetch<{ ok: boolean }>(`/api/visitors/blocklist/${encodeURIComponent(ip)}`, token, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: visitorKeys.blocklist });
      queryClient.invalidateQueries({ queryKey: visitorKeys.list });
    },
  });
}
