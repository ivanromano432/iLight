// Service Worker GoalFit — gestisce solo le push notifications.
// Non cacha asset (la PWA usa il cache normale del browser/Netlify) per evitare
// problemi di sincronizzazione con i deploy.

self.addEventListener('install', (event) => {
  // Attivati subito senza aspettare che le pagine vecchie chiudano
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Prendi il controllo di tutte le pagine immediatamente
  event.waitUntil(self.clients.claim());
});

// Ricezione di una push: mostra una notifica
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'GoalFit', body: event.data?.text() || '' };
  }

  const title = data.title || 'GoalFit';
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'goalfit-reminder',
    data: { url: data.url || '/' },
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Click sulla notifica → apri l'app (o portala in primo piano se già aperta)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification?.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Se c'è già una finestra dell'app aperta, focusla
      for (const client of clientList) {
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
          return client.focus();
        }
      }
      // Altrimenti apri una nuova finestra
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
