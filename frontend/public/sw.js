/* eslint-disable no-undef */
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'ServerDock', {
      body: data.body ?? '',
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      data: { gameId: data.gameId },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const focused = wins.find((w) => w.focused) ?? wins[0];
      if (focused) return focused.focus();
      return clients.openWindow('/admin');
    })
  );
});
