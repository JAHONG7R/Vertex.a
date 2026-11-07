'use strict';

self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; }
  catch (_) { payload = { body: event.data ? event.data.text() : '' }; }

  const title = payload.title || 'Vertex eslatmasi';
  const options = {
    body: payload.body || 'Rejalashtirilgan vazifangiz vaqti keldi.',
    icon: './icons/vertex-192.png',
    badge: './icons/vertex-192.png',
    tag: payload.tag || 'vertex-reminder',
    renotify: true,
    data: { url: payload.url || './' },
    actions: [{ action: 'open', title: 'Vertex’ni ochish' }]
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || './', self.location.origin).href;
  event.waitUntil((async () => {
    const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clientsList) {
      if (client.url.startsWith(self.location.origin) && 'focus' in client) return client.focus();
    }
    if (self.clients.openWindow) return self.clients.openWindow(target);
  })());
});

self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
