import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../../context/AuthContext';
import type { Permission } from '../../../../types';
import { adminsFetch } from './adminsApi';
import { adminKeys } from './queryKeys';

export function usePermissionCatalog() {
  const { token } = useAuth();
  return useQuery({
    queryKey: adminKeys.permissions,
    queryFn: () => adminsFetch<Permission[]>('/api/admins/permissions', token),
    enabled: !!token,
  });
}
