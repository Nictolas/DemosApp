// Service Worker per Firebase Cloud Messaging
// Questo file deve essere nella cartella public per essere accessibile

importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-messaging-compat.js');

// Inizializza Firebase nel Service Worker
// Le credenziali vengono passate dinamicamente dal client tramite postMessage
// Oppure usa queste credenziali se non vengono passate dinamicamente
firebase.initializeApp({
  apiKey: "AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:xxxxxxxxxxxxxxxxxxxxxx"
});

const messaging = firebase.messaging();

// Gestisci i messaggi in background
messaging.onBackgroundMessage((payload) => {
  console.log('📨 Messaggio push ricevuto in background:', payload);
  console.log('📋 Payload data:', payload.data);
  console.log('📋 Payload notification:', payload.notification);
  
  const notificationTitle = payload.notification?.title || payload.data?.titolo || 'Nuova notifica';
  const notificationBody = payload.notification?.body || payload.data?.messaggio || '';
  
  // Usa il tag dal payload se disponibile, altrimenti usa un default
  // Il tag viene passato in data.notificationTag dal backend
  const notificationTag = payload.data?.notificationTag || payload.notification?.tag || `demos-notification-${Date.now()}`;
  
  console.log('🔔 Mostro notifica in background con tag:', notificationTag);
  
  const notificationOptions = {
    body: notificationBody,
    icon: payload.notification?.icon || '/icona.png',
    badge: '/icona.png',
    tag: notificationTag, // Usa il tag dal backend per evitare duplicati
    data: {
      ...payload.data,
      url: payload.data?.url || '/notifiche',
      link: payload.data?.link || 'https://www.demos.community/notifiche'
    },
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
    // Usa il link dal data se disponibile, altrimenti usa l'URL
    const url = event.notification.data?.link || event.notification.data?.url || '/notifiche';
    
    // Apri l'app quando l'utente clicca sulla notifica
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        // Se c'è già una finestra aperta, portala in primo piano
        for (const client of clientList) {
          if (client.url.includes('demos.community') && 'focus' in client) {
            return client.focus().then(() => {
              // Naviga alla pagina della notifica
              if (url.startsWith('http')) {
                return client.navigate(url);
              } else {
                return client.navigate(new URL(url, client.url).href);
              }
            });
          }
        }
        // Se non c'è una finestra aperta, aprine una nuova
        if (clients.openWindow) {
          if (url.startsWith('http')) {
            return clients.openWindow(url);
          } else {
            return clients.openWindow(new URL(url, self.location.origin).href);
          }
        }
      })
    );
  }
});

