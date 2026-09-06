import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../../context/AuthContext';
import type { Admin } from '../../../../types';
import { adminsFetch } from './adminsApi';
import { adminKeys } from './queryKeys';

export function useAdmins() {
  const { token } = useAuth();
  return useQuery({
    queryKey: adminKeys.list,
    queryFn: () => adminsFetch<Admin[]>('/api/admins', token),
    enabled: !!token,
  });
}
