// DEMOS legacy PWA service worker retirement.
// Non usare una cache-first strategy per la shell applicativa:
// l'HTML vecchio può puntare a bundle React obsoleti dopo un deploy.
// Il worker delle notifiche Firebase è un file separato e non viene modificato.
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names.filter((name) => /^demos-v\d+$/.test(name)).map((name) => caches.delete(name))
    );
    await self.clients.claim();
    await self.registration.unregister();
  })());
});

// Intenzionalmente nessun fetch handler: tutte le risorse passano alla rete.
