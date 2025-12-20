// Service Worker per Firebase Cloud Messaging
// Questo file deve essere nella cartella public per essere accessibile

importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-messaging-compat.js');

// Inizializza Firebase nel Service Worker
// Le credenziali vengono passate dinamicamente dal client tramite postMessage
// Oppure usa queste credenziali se non vengono passate dinamicamente
firebase.initializeApp({
  apiKey: "AIzaSyA13nlciCI04aVODsrTKwgvr_Y3lp-ozBY",
  authDomain: "demos-finale.firebaseapp.com",
  projectId: "demos-finale",
  storageBucket: "demos-finale.firebasestorage.app",
  messagingSenderId: "848085963511",
  appId: "1:848085963511:web:2efb3d13fb5576ecd0b9f2"
});

const messaging = firebase.messaging();

// Gestisci i messaggi in background
messaging.onBackgroundMessage((payload) => {
  console.log('📨 Messaggio push ricevuto in background:', payload);
  
  const notificationTitle = payload.notification?.title || 'Nuova notifica';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: payload.notification?.icon || '/icona.png',
    badge: '/icona.png',
    tag: 'demos-notification',
    data: payload.data,
    requireInteraction: true,
    actions: [
      {
        action: 'open',
        title: 'Apri'
      },
      {
        action: 'close',
        title: 'Chiudi'
      }
    ]
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Gestisci i click sulle notifiche
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Click su notifica:', event);
  
  event.notification.close();

  if (event.action === 'open' || !event.action) {
    // Apri l'app quando l'utente clicca sulla notifica
    event.waitUntil(
      clients.openWindow(event.notification.data?.url || '/comunica')
    );
  }
});

