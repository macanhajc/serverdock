import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../../context/AuthContext';
import type { Admin, AdminRole, Permission } from '../../../../types';
import { adminsFetch } from './adminsApi';
import { adminKeys } from './queryKeys';

export function useCreateAdmin() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      username: string;
      password: string;
      role: AdminRole;
      permissions: Permission[];
    }) =>
      adminsFetch<Admin>('/api/admins', token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.list });
    },
  });
}
