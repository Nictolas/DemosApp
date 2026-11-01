// Firebase Cloud Messaging service worker for DEMOS web push.
// Firebase public web config is supplied by the registered script URL query string.
// No project-specific placeholder or secret is stored in this static file.

importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-messaging-compat.js');

const scriptUrl = new URL(self.location.href);
const firebaseConfig = {
  apiKey: scriptUrl.searchParams.get('apiKey') || '',
  authDomain: scriptUrl.searchParams.get('authDomain') || '',
  projectId: scriptUrl.searchParams.get('projectId') || '',
  storageBucket: scriptUrl.searchParams.get('storageBucket') || '',
  messagingSenderId: scriptUrl.searchParams.get('messagingSenderId') || '',
  appId: scriptUrl.searchParams.get('appId') || '',
};

const hasRequiredFirebaseConfig = Boolean(
  firebaseConfig.apiKey
  && firebaseConfig.projectId
  && firebaseConfig.messagingSenderId
  && firebaseConfig.appId
);

if (hasRequiredFirebaseConfig) {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    // FCM already displays background messages with a notification payload.
    // Showing it again here would create a duplicate civic notification.
    // The webpush.fcmOptions.link supplied by the server remains actionable.
    if (payload.data?.type === 'civic_new_initiative' && payload.notification) {
      return;
    }
    const notificationTitle = payload.notification?.title || payload.data?.titolo || 'Nuova notifica';
    const notificationBody = payload.notification?.body || payload.data?.messaggio || '';
    const notificationTag = payload.data?.notificationTag
      || payload.notification?.tag
      || `demos-notification-${Date.now()}`;

    const notificationOptions = {
      body: notificationBody,
      icon: payload.notification?.icon || '/icona.png',
      badge: '/icona.png',
      tag: notificationTag,
      data: {
        ...payload.data,
        url: payload.data?.url || '/notifiche',
        link: payload.data?.link || 'https://www.demos.community/notifiche',
      },
      requireInteraction: true,
      actions: [
        { action: 'open', title: 'Apri' },
        { action: 'close', title: 'Chiudi' },
      ],
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
  });
} else {
  console.error('FCM service worker avviato senza configurazione Firebase completa');
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'close') return;

  const targetUrl = event.notification.data?.link
    || event.notification.data?.url
    || '/notifiche';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client && new URL(client.url).origin === self.location.origin) {
          return client.focus().then(() => client.navigate(new URL(targetUrl, self.location.origin).href));
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(new URL(targetUrl, self.location.origin).href);
      }
      return undefined;
    })
  );
});
