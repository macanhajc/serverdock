import { useMutation } from '@tanstack/react-query';
import { useAuth } from '../../../../context/AuthContext';
import { settingsFetch } from './settingsApi';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export interface SubscribePushResult {
  permission: NotificationPermission;
  subscription: PushSubscription | null;
}

export function useSubscribePush(vapidPublicKey: string) {
  const { token } = useAuth();
  return useMutation({
    mutationFn: async (): Promise<SubscribePushResult> => {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return { permission, subscription: null };

      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      });
      await settingsFetch('/api/push/subscribe', token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      });
      return { permission, subscription };
    },
  });
}
