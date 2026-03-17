// Service Worker per DEMOS PWA
const CACHE_NAME = 'demos-v5';
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
  const url = new URL(event.request.url);
  
  // NON intercettare le richieste API - lasciale passare direttamente alla rete
  if (url.pathname.startsWith('/api/') || 
      url.hostname.includes('api.demos.community') ||
      url.hostname.includes('demos-c7k0.onrender.com') ||
      url.hostname.includes('localhost') && url.port === '3001') {
    // Per le richieste API, passa direttamente alla rete senza cache
    return fetch(event.request);
  }
  
  // Non cachare i file JavaScript e CSS per evitare problemi di aggiornamento
  if (event.request.url.includes('.js') || event.request.url.includes('.css')) {
    return fetch(event.request);
  }
  
  // Per le altre richieste, usa la cache
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
