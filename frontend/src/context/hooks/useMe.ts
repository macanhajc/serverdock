import { useQuery } from '@tanstack/react-query';
import type { AdminRole, Permission } from '../../types';
import { authKeys } from './queryKeys';

interface Me {
  username: string;
  role: AdminRole;
  permissions: Permission[] | null;
}

// Fires whenever a token is present — on mount if one was already in
// sessionStorage, and again the moment login() sets a fresh one. A failure
// (or no token) just leaves `data` undefined, same as the original silently
// swallowing a rejected fetch and leaving username/role/permissions unset.
export function useMe(token: string | null) {
  return useQuery({
    queryKey: authKeys.me,
    queryFn: async () => {
      const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json() as Promise<Me>;
    },
    enabled: !!token,
  });
}
