import { useMutation } from '@tanstack/react-query';
import { useAuth } from '../../../../context/AuthContext';
import { adminsFetch } from './adminsApi';

export function useResetAdminPassword() {
  const { token } = useAuth();
  return useMutation({
    mutationFn: ({ id, newPassword }: { id: string; newPassword: string }) =>
      adminsFetch<{ message: string }>(`/api/admins/${id}/password`, token, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword }),
      }),
  });
}
