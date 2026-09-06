import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../../context/AuthContext';
import { visitorsFetch } from './visitorsApi';
import { visitorKeys } from './queryKeys';

export function useUnblockVisitor() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      visitorsFetch<{ ok: boolean }>(`/api/visitors/${id}/unblock`, token, { method: 'PATCH' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: visitorKeys.list });
      queryClient.invalidateQueries({ queryKey: visitorKeys.blocklist });
    },
  });
}
