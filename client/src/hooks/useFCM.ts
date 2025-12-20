import { useState, useEffect } from 'react';
import { getMessaging, getToken as getFCMToken, onMessage, Messaging } from 'firebase/messaging';
import { initializeApp, FirebaseApp } from 'firebase/app';

/**
 * Hook per ottenere e gestire il token FCM per notifiche push web
 * Usa Firebase Cloud Messaging per web
 */
export function useFCM() {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const [message, setMessage] = useState<any>(null);
  const [messaging, setMessaging] = useState<Messaging | null>(null);

  // Inizializza Firebase se non già fatto
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Verifica permesso notifiche
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }

    // Inizializza Firebase Messaging con le credenziali essenziali
    // NOTA: Per FCM web NON serve Firestore o altri servizi Firebase
    // Serve solo: projectId, messagingSenderId, e VAPID key (per l'autenticazione)
    const firebaseConfig = {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
      measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
    };
    
    // Log per debug
    console.log('🔧 Configurazione Firebase FCM:', {
      projectId: firebaseConfig.projectId || 'MANCANTE',
      messagingSenderId: firebaseConfig.messagingSenderId || 'MANCANTE',
      apiKey: firebaseConfig.apiKey ? `${firebaseConfig.apiKey.substring(0, 10)}...` : 'MANCANTE',
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY ? 'PRESENTE' : 'MANCANTE'
    });

    // Verifica se abbiamo almeno le credenziali essenziali per FCM web
    // Servono: projectId, messagingSenderId, e vapidKey (quest'ultima viene usata dopo)
    if (firebaseConfig.projectId && firebaseConfig.messagingSenderId) {
      try {
        const app: FirebaseApp = initializeApp(firebaseConfig);
        if ('serviceWorker' in navigator && 'Notification' in window) {
          const messagingInstance = getMessaging(app);
          setMessaging(messagingInstance);
          console.log('✅ Firebase Messaging inizializzato per web push');
          console.log('   Project ID:', firebaseConfig.projectId);
          console.log('   Messaging Sender ID:', firebaseConfig.messagingSenderId);
          console.log('   VAPID Key presente:', !!import.meta.env.VITE_FIREBASE_VAPID_KEY);
        }
      } catch (firebaseError) {
        console.warn('⚠️ Firebase non configurato o non disponibile:', firebaseError);
        // Non è un errore critico, continuiamo senza Firebase
      }
    } else {
      console.warn('⚠️ Credenziali Firebase essenziali non configurate');
      console.warn('   VITE_FIREBASE_PROJECT_ID:', firebaseConfig.projectId || 'MANCANTE');
      console.warn('   VITE_FIREBASE_MESSAGING_SENDER_ID:', firebaseConfig.messagingSenderId || 'MANCANTE');
      console.warn('   VITE_FIREBASE_VAPID_KEY:', import.meta.env.VITE_FIREBASE_VAPID_KEY ? 'PRESENTE' : 'MANCANTE');
      console.warn('   Le notifiche push web non funzioneranno.');
    }
  }, []);

  // Richiedi permesso notifiche
  const requestPermission = async () => {
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
      const permission = await Notification.requestPermission();
      setPermission(permission);
      
      if (permission === 'granted') {
        await getToken();
      } else {
        setError(new Error('Permesso notifiche negato'));
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Errore nella richiesta permesso');
      setError(error);
    }
  };

  // Ottieni token FCM per web
  const getToken = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Se Firebase Messaging è disponibile, usa quello
      if (messaging) {
        try {
          // Registra Service Worker se necessario
          if ('serviceWorker' in navigator) {
            try {
              const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
                scope: '/'
              });
              console.log('✅ Service Worker registrato per FCM');
            } catch (swError) {
              console.warn('⚠️ Errore registrazione Service Worker:', swError);
              // Prova comunque a ottenere il token
            }
          }

          const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
          console.log('🔑 VAPID Key check:', vapidKey ? `Presente (${vapidKey.substring(0, 20)}...)` : 'MANCANTE');
          
          if (!vapidKey) {
            throw new Error('VAPID key non configurata. Configura VITE_FIREBASE_VAPID_KEY nel frontend e rideploya.');
          }

          console.log('🔐 Tentativo di ottenere token FCM con VAPID key...');
          const currentToken = await getFCMToken(messaging, { vapidKey });
          
          if (currentToken) {
            setToken(currentToken);
            console.log('✅ Token FCM ottenuto:', currentToken.substring(0, 30) + '...');
          } else {
            throw new Error('Nessun token FCM disponibile');
          }
        } catch (fcmError: any) {
          console.error('❌ Errore nel recupero token FCM:', fcmError);
          
          // Se Firebase non è disponibile, genera un device ID come fallback
          // (ma questo non funzionerà per le notifiche push reali)
          const deviceId = localStorage.getItem('device_id') || 
            `web_${Date.now()}_${Math.random().toString(36).substring(7)}`;
          localStorage.setItem('device_id', deviceId);
          setToken(deviceId);
          setError(new Error('Firebase FCM non disponibile. Usato device ID (notifiche push non funzioneranno)'));
        }
      } else {
        // Fallback: genera un device ID (non funzionerà per notifiche push reali)
        const deviceId = localStorage.getItem('device_id') || 
          `web_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        localStorage.setItem('device_id', deviceId);
        setToken(deviceId);
        setError(new Error('Firebase Messaging non configurato. Notifiche push non disponibili.'));
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Errore nel recupero token');
      setError(error);
      console.error('Errore nel recupero token FCM:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Ascolta messaggi push
  useEffect(() => {
    if (!messaging) return;

    const unsubscribe = onMessage(messaging, (payload) => {
      console.log('📨 Messaggio push ricevuto:', payload);
      setMessage(payload);
      
      // Mostra notifica se l'app è in foreground
      if (Notification.permission === 'granted') {
        const notificationTitle = payload.notification?.title || 'Nuova notifica';
        const notificationOptions = {
          body: payload.notification?.body || '',
          icon: payload.notification?.icon || '/icona.png',
          badge: '/icona.png',
          tag: 'demos-notification',
          data: payload.data
        };
        
        new Notification(notificationTitle, notificationOptions);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [messaging]);

  return {
    token,
    isLoading,
    error,
    permission,
    message,
    requestPermission,
    getToken
  };
}
