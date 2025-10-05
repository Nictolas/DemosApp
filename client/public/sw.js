// Service Worker per DEMOS PWA
const CACHE_NAME = 'demos-v3';
const urlsToCache = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/icona.png',
  '/manifest.json'
];

// Installazione del Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Cache aperta');
        return cache.addAll(urlsToCache).catch((error) => {
          console.warn('Errore nel caching di alcune risorse:', error);
          // Continua anche se alcune risorse non possono essere cachate
          return Promise.resolve();
        });
      })
  );
});

// Attivazione del Service Worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Rimozione cache vecchia:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Intercettazione delle richieste
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Restituisce la risposta dalla cache se disponibile
        if (response) {
          return response;
        }
        
        // Altrimenti, effettua la richiesta di rete
        return fetch(event.request);
      }
    )
  );
});
