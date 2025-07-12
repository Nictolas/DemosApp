import { useEffect, useState } from 'react';
import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging';
import { initializeApp } from 'firebase/app';

// Configurazione Firebase (deve corrispondere a quella usata nell'app)
const firebaseConfig = {
  apiKey: "<REDACTED_GCP_API_KEY>",
  authDomain: "demos-finale.firebaseapp.com",
  projectId: "demos-finale",
  storageBucket: "demos-finale.firebasestorage.app",
  messagingSenderId: "848085963511",
  appId: "1:848085963511:web:2efb3d13fb5576ecd0b9f2",
  measurementId: "G-HSP3FK0GFN"
};

let messaging: Messaging | null = null;

export function useFCM() {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const [message, setMessage] = useState<any>(null);

  useEffect(() => {
    // Inizializza Firebase Messaging solo se siamo nel browser
    if (typeof window === 'undefined') return;
    try {
      const app = initializeApp(firebaseConfig);
      messaging = getMessaging(app);
    } catch (e) {
      // Firebase già inizializzato
      if (!messaging) {
        try {
          messaging = getMessaging();
        } catch (err) {
          setError('Errore inizializzazione Firebase Messaging');
        }
      }
    }
  }, []);

  useEffect(() => {
    if (!messaging) return;
    // Chiedi permesso all'utente
    Notification.requestPermission().then((perm) => {
      setPermission(perm);
      if (perm === 'granted') {
        // Registra il service worker
        navigator.serviceWorker
          .register('/firebase-messaging-sw.js')
          .then((registration) => {
            // Ottieni il token FCM
            getToken(messaging!, {
              vapidKey: 'BJKQw1Qw1w1Qw1Qw1Qw1Qw1Qw1Qw1Qw1Qw1Qw1Qw1Qw1Qw1Qw1Qw1Qw1Qw1Qw1Qw1Qw1Qw1Qw1Qw', // Sostituisci con la tua VAPID KEY pubblica
              serviceWorkerRegistration: registration,
            })
              .then((currentToken) => {
                if (currentToken) {
                  setToken(currentToken);
                } else {
                  setError('Nessun token disponibile. Permesso non concesso?');
                }
              })
              .catch((err) => {
                setError('Errore ottenimento token: ' + err.message);
              });
          })
          .catch((err) => {
            setError('Errore registrazione Service Worker: ' + err.message);
          });
      } else {
        setError('Permesso notifiche non concesso');
      }
    });
  }, [messaging]);

  useEffect(() => {
    if (!messaging) return;
    // Listener per notifiche in foreground
    const unsubscribe = onMessage(messaging, (payload) => {
      setMessage(payload);
    });
    return () => unsubscribe();
  }, [messaging]);

  return { token, error, permission, message };
} 