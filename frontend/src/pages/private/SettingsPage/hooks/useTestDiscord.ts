import { useMutation } from '@tanstack/react-query';
import { useAuth } from '../../../../context/AuthContext';
import { settingsFetch } from './settingsApi';

export function useTestDiscord() {
  const { token } = useAuth();
  return useMutation({
    mutationFn: () => settingsFetch<void>('/api/settings/notify/test-discord', token, { method: 'POST' }),
  });
}
