import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { getMessaging, getToken as getFCMToken, onMessage, Messaging } from 'firebase/messaging';
import { initializeApp, getApp, getApps, FirebaseApp } from 'firebase/app';

function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/**
 * Hook per ottenere e gestire il token FCM per notifiche push web
 * Usa Firebase Cloud Messaging per web
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

  // Inizializza Firebase se non già fatto
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Firebase Web Messaging non deve partire dentro la WebView Capacitor.
    if (isNativeApp()) {
      setMessaging(null);
      setPermission(null);
      return;
    }

    // Verifica permesso notifiche
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }

    // Inizializza Firebase Messaging con le credenziali essenziali
    // NOTA: Per FCM web NON serve Firestore o altri servizi Firebase
    // Serve solo: projectId, messagingSenderId, e VAPID key (per l'autenticazione)
    
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
        const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
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
      if (isNativeApp()) {
        setToken(null);
        setError(new Error("FCM web disabilitato nell'app nativa."));
        return;
      }

      // Se Firebase Messaging è disponibile, usa quello
      if (messaging) {
        try {
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
          console.log('✅ Service Worker FCM configurato e registrato');

          const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
          
          // Log dettagliato per debug
          console.log('🔑 VAPID Key check:', {
            presente: !!vapidKey,
            lunghezza: vapidKey ? vapidKey.length : 0,
            inizio: vapidKey ? vapidKey.substring(0, 30) + '...' : 'N/A',
            tutteEnvVars: Object.keys(import.meta.env).filter(k => k.startsWith('VITE_FIREBASE_'))
          });
          
          if (!vapidKey) {
            console.error('❌ VAPID KEY MANCANTE!');
            console.error('   Verifica che VITE_FIREBASE_VAPID_KEY sia configurata su Render.com');
            console.error('   E che il frontend sia stato rideployato dopo averla aggiunta');
            throw new Error('VAPID key non configurata. Configura VITE_FIREBASE_VAPID_KEY nel frontend e rideploya.');
          }

          if (vapidKey.length < 80) {
            console.warn('⚠️ VAPID key sembra troppo corta. Dovrebbe essere ~87 caratteri');
          }

          console.log('🔐 Tentativo di ottenere token FCM con VAPID key...');
          
          // Non hardcodare mai una VAPID "attesa" nel codice: usa solo la variabile d'ambiente.
          
          const currentToken = await getFCMToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
          
          if (currentToken) {
            setToken(currentToken);
            console.log('✅ Token FCM ottenuto:', currentToken.substring(0, 30) + '...');
          } else {
            throw new Error('Nessun token FCM disponibile');
          }
        } catch (fcmError: any) {
          console.error('❌ Errore nel recupero token FCM:', fcmError);
          
          // Fail closed: un device ID locale non è un token FCM e non deve mai essere sincronizzato.
          setToken(null);
          setError(new Error('Firebase FCM non disponibile. Token push non creato.'));
        }
      } else {
        setToken(null);
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
      console.log('📨 Messaggio push ricevuto in foreground:', payload);
      setMessage(payload);
      
      // Mostra notifica quando l'app è in foreground
      // IMPORTANTE: onMessage viene chiamato SOLO quando l'app è in foreground
      // onBackgroundMessage viene chiamato SOLO quando l'app è in background/chiusa
      // Quindi non ci dovrebbero essere duplicati se usiamo il tag correttamente
      if (Notification.permission === 'granted') {
        const notificationTitle = payload.notification?.title || payload.data?.titolo || 'Nuova notifica';
        const notificationBody = payload.notification?.body || payload.data?.messaggio || '';
        
        // Usa il tag dal payload se disponibile, altrimenti usa un default
        // Il tag deve essere UNICO per questa notifica per evitare duplicati
        const notificationTag = payload.data?.notificationTag || `demos-notification-${Date.now()}`;
        
        console.log('🔔 Mostro notifica in foreground con tag:', notificationTag);
        
        const notificationOptions: NotificationOptions = {
          body: notificationBody,
          icon: payload.notification?.icon || '/icona.png',
          badge: '/icona.png',
          tag: notificationTag, // Tag univoco per evitare duplicati
          requireInteraction: true,
          data: {
            ...payload.data,
            url: payload.data?.url || '/notifiche',
            link: payload.data?.link || 'https://www.demos.community/notifiche'
          }
        };
        
        // Mostra la notifica
        const notification = new Notification(notificationTitle, notificationOptions);
        
        // Gestisci il click sulla notifica
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
