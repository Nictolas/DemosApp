import { initializeApp, getApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// IMPORT CORRETTO per firebase-admin, per risolvere l'errore TypeError
import admin from "firebase-admin";

// ==============================================================
// CONFIGURAZIONE FIREBASE PER IL CLIENT (BROWSER)
// Legge le variabili d'ambiente.
// ==============================================================
const clientConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Inizializza l'app Firebase (lato client) solo se non è già inizializzata
const app = getApps().length > 0 ? getApp() : initializeApp(clientConfig);

// Istanzia i servizi client-side
const db = getFirestore(app);
const auth = getAuth(app);


// ==============================================================
// CONFIGURAZIONE FIREBASE ADMIN SDK (SOLO PER IL SERVER)
// ==============================================================
let adminDb: admin.firestore.Firestore | null = null;
let adminAuth: admin.auth.Auth | null = null;

// LOGICA DI INIZIALIZZAZIONE CORRETTA
// Controlla se ci sono app admin già inizializzate in modo sicuro
if (admin.apps.length === 0) { 
  try {
    // Prova a inizializzare solo se le credenziali del server esistono
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          // La sostituzione di \n è fondamentale
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });

      adminDb = admin.firestore();
      adminAuth = admin.auth();
      console.log('Firebase Admin SDK inizializzato con successo.');
    } else {
      // Questo avviso apparirà nei log se le credenziali server-side mancano
      console.warn('Credenziali Firebase Admin non trovate nei Secrets/variabili d\'ambiente. Admin SDK non sarà disponibile.');
    }
  } catch (error) {
    console.error('ERRORE CRITICO: Impossibile inizializzare Firebase Admin SDK.', error);
  }
} else {
  // Se l'app è già inizializzata (es. in sviluppo con hot-reloading), 
  // prendi semplicemente le istanze esistenti per evitare errori.
  adminDb = admin.firestore();
  adminAuth = admin.auth();
}

// Esporta tutte le istanze per usarle negli altri servizi
export { db, auth, adminDb, adminAuth };