import { useEffect, useState } from 'react';

// Browser-native push support/permission/subscription state — this isn't
// server data, so it doesn't belong in react-query. Kept separate from the
// subscribe/unsubscribe/test mutations below so those can stay focused on
// the network calls.
export function usePushState() {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    setSupported(true);
    setPermission(Notification.permission);
    navigator.serviceWorker.ready.then((reg) =>
      reg.pushManager.getSubscription().then(setSubscription)
    );
  }, []);

  return { supported, permission, subscription, setPermission, setSubscription };
}
