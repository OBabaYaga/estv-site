// ===================================================================
// ESTV — Service Worker
// Recebe as notificações push (ex: "O Edu está em direto!") mesmo com
// o site/app fechado, e abre o link certo quando se toca nelas.
// ===================================================================

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let dados = {};
  try {
    dados = event.data ? event.data.json() : {};
  } catch (e) {
    dados = { texto: event.data ? event.data.text() : '' };
  }
  const base = self.registration.scope;
  event.waitUntil(
    self.registration.showNotification(dados.titulo || 'ESTV', {
      body: dados.texto || '',
      icon: base + 'assets/app/icon-192.png',
      badge: base + 'assets/app/badge-96.png',
      tag: dados.tag || 'estv',
      renotify: true,
      data: { url: dados.url || base },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || self.registration.scope;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      for (const j of janelas) {
        if (j.url === url && 'focus' in j) return j.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
