import { useMutation } from '@tanstack/react-query';
import { useAuth } from '../../../../context/AuthContext';
import { settingsFetch } from './settingsApi';

export function useWipeAll() {
  const { token } = useAuth();
  return useMutation({
    mutationFn: () =>
      settingsFetch<{ wiped: number }>('/api/settings/wipe-all', token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true }),
      }),
  });
}
