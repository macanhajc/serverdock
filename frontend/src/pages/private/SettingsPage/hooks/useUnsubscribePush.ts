import { useMutation } from '@tanstack/react-query';
import { useAuth } from '../../../../context/AuthContext';
import { settingsFetch } from './settingsApi';

export function useUnsubscribePush() {
  const { token } = useAuth();
  return useMutation({
    mutationFn: async (subscription: PushSubscription) => {
      await settingsFetch('/api/push/subscribe', token, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
      await subscription.unsubscribe();
    },
  });
}
