import { useEffect, useState, useCallback } from 'react';
import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging';
import { initializeApp } from 'firebase/app';

// Configurazione Firebase (deve corrispondere a quella usata nell'app)
const firebaseConfig = {
  apiKey: "<REDACTED_GCP_API_KEY>",
  authDomain: "demos-finale.firebaseapp.com",
  projectId: "demos-finale",
  storageBucket: "demos-finale.appspot.com",
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
  const [isLoading, setIsLoading] = useState(false);

  // Inizializza Firebase Messaging solo una volta
  useEffect(() => {
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
    setPermission(Notification.permission);
  }, []);

  // Ottieni token solo se il permesso è già granted
  useEffect(() => {
    if (!messaging) return;
    if (permission !== 'granted') return;
    setIsLoading(true);
    navigator.serviceWorker
      .register('/firebase-messaging-sw.js')
      .then((registration) => {
        getToken(messaging!, {
          vapidKey: 'BIHJ29xtgACTW0TrdApZa1XsV-h7LIa5qoxah13RtkWHCKU_UJLwO4vMeXeMhvpz7XEFhas-r5t4uuhLsAcOoBw',
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
          })
          .finally(() => setIsLoading(false));
      })
      .catch((err) => {
        setError('Errore registrazione Service Worker: ' + err.message);
        setIsLoading(false);
      });
  }, [permission]);

  // Listener per notifiche in foreground
  useEffect(() => {
    if (!messaging) return;
    const unsubscribe = onMessage(messaging, (payload) => {
      setMessage(payload);
    });
    return () => unsubscribe();
  }, [messaging]);

  // Funzione da chiamare su click utente
  const requestPermission = useCallback(async () => {
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      return perm;
    } catch (err: any) {
      setError('Errore richiesta permesso notifiche: ' + err.message);
      return 'default';
    }
  }, []);

  return { token, error, permission, message, isLoading, requestPermission };
} 