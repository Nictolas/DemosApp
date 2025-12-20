// Service Worker per Firebase Cloud Messaging
// Questo file deve essere nella cartella public per essere accessibile

importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-messaging-compat.js');

// Inizializza Firebase nel Service Worker
// NOTA: Le credenziali devono essere configurate qui o passate dal client
firebase.initializeApp({
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
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

