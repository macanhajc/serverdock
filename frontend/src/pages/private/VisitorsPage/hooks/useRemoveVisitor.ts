import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../../context/AuthContext';
import { visitorsFetch } from './visitorsApi';
import { visitorKeys } from './queryKeys';

export function useRemoveVisitor() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      visitorsFetch<{ ok: boolean }>(`/api/visitors/${id}`, token, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: visitorKeys.list });
    },
  });
}
