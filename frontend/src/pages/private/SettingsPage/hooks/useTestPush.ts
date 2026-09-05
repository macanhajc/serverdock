import { useMutation } from '@tanstack/react-query';
import { useAuth } from '../../../../context/AuthContext';
import { settingsFetch } from './settingsApi';

export function useTestPush() {
  const { token } = useAuth();
  return useMutation({
    mutationFn: (endpoint: string | undefined) =>
      settingsFetch<void>('/api/push/test', token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint }),
      }),
  });
}
