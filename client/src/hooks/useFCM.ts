import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { initializeApp, getApp, getApps, FirebaseApp } from 'firebase/app';
import { getMessaging, getToken as getFCMToken, onMessage, Messaging } from 'firebase/messaging';

function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/**
 * Hook per ottenere e gestire il token FCM per notifiche push web.
 * Il percorso Firebase Web Messaging è intenzionalmente disabilitato dentro
 * l'app nativa Capacitor: Android userà un'integrazione push nativa dedicata.
 */
export function useFCM() {
  const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
  };

  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const [message, setMessage] = useState<any>(null);
  const [messaging, setMessaging] = useState<Messaging | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Firebase Web Messaging non deve partire nella WebView Capacitor.
    // Evita registrazioni Service Worker / Notification API web nell'app nativa.
    if (isNativeApp()) {
      setMessaging(null);
      setPermission(null);
      return;
    }

    if ('Notification' in window) {
      setPermission(Notification.permission);
    }

    if (firebaseConfig.projectId && firebaseConfig.messagingSenderId) {
      try {
        const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
        if ('serviceWorker' in navigator && 'Notification' in window) {
          setMessaging(getMessaging(app));
        }
      } catch (firebaseError) {
        console.warn('Firebase Messaging non disponibile:', firebaseError);
      }
    } else {
      console.warn('Credenziali Firebase essenziali non configurate; push web disabilitato.');
    }
  }, []);

  const getToken = async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (isNativeApp()) {
        setToken(null);
        setError(new Error('FCM web disabilitato nell’app nativa.'));
        return;
      }

      if (!messaging) {
        setToken(null);
        setError(new Error('Firebase Messaging non configurato. Notifiche push non disponibili.'));
        return;
      }

      if (!('serviceWorker' in navigator)) {
        throw new Error('Service Worker non supportato dal browser');
      }

      const swParams = new URLSearchParams({
        apiKey: String(firebaseConfig.apiKey || ''),
        authDomain: String(firebaseConfig.authDomain || ''),
        projectId: String(firebaseConfig.projectId || ''),
        storageBucket: String(firebaseConfig.storageBucket || ''),
        messagingSenderId: String(firebaseConfig.messagingSenderId || ''),
        appId: String(firebaseConfig.appId || ''),
      });

      const registration = await navigator.serviceWorker.register(
        `/firebase-messaging-sw.js?${swParams.toString()}`,
        { scope: '/' }
      );
      await navigator.serviceWorker.ready;

      const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
      if (!vapidKey) {
        throw new Error('VAPID key non configurata.');
      }

      const currentToken = await getFCMToken(messaging, {
        vapidKey,
        serviceWorkerRegistration: registration,
      });

      if (!currentToken) {
        throw new Error('Nessun token FCM disponibile');
      }

      setToken(currentToken);
    } catch (err) {
      const nextError = err instanceof Error ? err : new Error('Errore nel recupero token FCM');
      setToken(null);
      setError(nextError);
      console.error('Errore nel recupero token FCM:', nextError);
    } finally {
      setIsLoading(false);
    }
  };

  const requestPermission = async () => {
    setError(null);

    if (isNativeApp()) {
      setError(new Error('Le notifiche push native non sono ancora configurate.'));
      return;
    }

    if (typeof window === 'undefined' || !('Notification' in window)) {
      setError(new Error('Notifiche non supportate dal browser'));
      return;
    }

    if (Notification.permission === 'granted') {
      setPermission('granted');
      await getToken();
      return;
    }

    if (Notification.permission === 'denied') {
      setError(new Error('Permesso notifiche negato'));
      setPermission('denied');
      return;
    }

    try {
      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);

      if (nextPermission === 'granted') {
        await getToken();
      } else {
        setError(new Error('Permesso notifiche negato'));
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Errore nella richiesta permesso'));
    }
  };

  useEffect(() => {
    if (!messaging || isNativeApp()) return;

    const unsubscribe = onMessage(messaging, (payload) => {
      setMessage(payload);

      if (Notification.permission !== 'granted') return;

      const notificationTitle = payload.notification?.title || payload.data?.titolo || 'Nuova notifica';
      const notificationBody = payload.notification?.body || payload.data?.messaggio || '';
      const notificationTag = payload.data?.notificationTag || `demos-notification-${Date.now()}`;

      const notificationOptions: NotificationOptions = {
        body: notificationBody,
        icon: payload.notification?.icon || '/icona.png',
        badge: '/icona.png',
        tag: notificationTag,
        requireInteraction: true,
        data: {
          ...payload.data,
          url: payload.data?.url || '/notifiche',
          link: payload.data?.link || 'https://www.demos.community/notifiche',
        },
      };

      const notification = new Notification(notificationTitle, notificationOptions);
      notification.onclick = (event) => {
        event.preventDefault();
        window.focus();
        const url = payload.data?.link || payload.data?.url || '/notifiche';
        if (url.startsWith('http')) {
          window.open(url, '_blank');
        } else {
          window.location.href = url;
        }
        notification.close();
      };
    });

    return () => unsubscribe();
  }, [messaging]);

  return {
    token,
    isLoading,
    error,
    permission,
    message,
    requestPermission,
    getToken,
  };
}
