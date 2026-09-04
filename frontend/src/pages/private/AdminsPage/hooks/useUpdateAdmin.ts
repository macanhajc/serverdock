import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../../context/AuthContext';
import type { Admin, AdminRole, Permission } from '../../../../types';
import { adminsFetch } from './adminsApi';
import { adminKeys } from './queryKeys';

export function useUpdateAdmin() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      role,
      permissions,
    }: {
      id: string;
      role: AdminRole;
      permissions: Permission[];
    }) =>
      adminsFetch<Admin>(`/api/admins/${id}`, token, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, permissions }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.list });
    },
  });
}
