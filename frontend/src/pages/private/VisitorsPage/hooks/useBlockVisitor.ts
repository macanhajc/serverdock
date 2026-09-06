import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../../context/AuthContext';
import { visitorsFetch } from './visitorsApi';
import { visitorKeys } from './queryKeys';

export function useBlockVisitor() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      visitorsFetch<{ ok: boolean }>(`/api/visitors/${id}/block`, token, { method: 'PATCH' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: visitorKeys.list });
      queryClient.invalidateQueries({ queryKey: visitorKeys.blocklist });
    },
  });
}
