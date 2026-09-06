import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../../context/AuthContext';
import { adminsFetch } from './adminsApi';
import { adminKeys } from './queryKeys';

export function useDeleteAdmin() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      adminsFetch<{ message: string }>(`/api/admins/${id}`, token, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.list });
    },
  });
}
