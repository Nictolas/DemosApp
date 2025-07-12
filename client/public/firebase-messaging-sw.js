// Firebase Cloud Messaging Service Worker
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Configurazione Firebase
const firebaseConfig = {
  apiKey: "<REDACTED_GCP_API_KEY>",
  authDomain: "demos-finale.firebaseapp.com",
  projectId: "demos-finale",
  storageBucket: "demos-finale.firebasestorage.app",
  messagingSenderId: "848085963511",
  appId: "1:848085963511:web:2efb3d13fb5576ecd0b9f2",
  measurementId: "G-HSP3FK0GFN"
};

// Inizializza Firebase
firebase.initializeApp(firebaseConfig);

// Inizializza Firebase Cloud Messaging
const messaging = firebase.messaging();

// Gestione notifiche in background
messaging.onBackgroundMessage((payload) => {
  console.log('Notifica ricevuta in background:', payload);

  const notificationTitle = payload.notification?.title || 'DEMOS';
  const notificationOptions = {
    body: payload.notification?.body || 'Nuova notifica',
    icon: '/icona.png',
    badge: '/icona.png',
    tag: 'demos-notification',
    data: payload.data || {},
    actions: [
      {
        action: 'open',
        title: 'Apri',
        icon: '/icona.png'
      },
      {
        action: 'close',
        title: 'Chiudi'
      }
    ],
    requireInteraction: true,
    silent: false
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Gestione click sulle notifiche
self.addEventListener('notificationclick', (event) => {
  console.log('Click su notifica:', event);

  event.notification.close();

  if (event.action === 'open' || !event.action) {
    // Apri l'app o una pagina specifica
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((clientList) => {
        // Se c'è già una finestra aperta, focalizzala
        for (const client of clientList) {
          if (client.url.includes('/') && 'focus' in client) {
            return client.focus();
          }
        }
        // Altrimenti apri una nuova finestra
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
    );
  }
});

// Gestione installazione del Service Worker
self.addEventListener('install', (event) => {
  console.log('Service Worker installato');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker attivato');
  event.waitUntil(self.clients.claim());
}); 