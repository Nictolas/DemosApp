import { initializeApp, getApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import * as admin from "firebase-admin";

// ==============================================================
// CONFIGURAZIONE FIREBASE PER IL CLIENT (BROWSER)
// Legge le variabili d'ambiente. Assicurati che siano impostate
// nel tuo file .env.local e sulla dashboard di Vercel.
// Il prefisso VITE_ è per Vite, altri framework usano prefissi diversi.
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
// per evitare errori in ambienti di hot-reloading.
const app = getApps().length > 0 ? getApp() : initializeApp(clientConfig);

// Istanzia i servizi client-side
const db = getFirestore(app);
const auth = getAuth(app);


// ==============================================================
// CONFIGURAZIONE FIREBASE ADMIN SDK (SOLO PER IL SERVER)
// Usa credenziali separate e più potenti, da non esporre mai al client.
// ==============================================================
let adminDb: admin.firestore.Firestore | null = null;
let adminAuth: admin.auth.Auth | null = null;

// Controlla se le credenziali admin esistono e se l'SDK non è già inizializzato.
// Questo codice viene eseguito solo nell'ambiente server (Node.js).
if (process.env.FIREBASE_PRIVATE_KEY && admin.apps.length === 0) {
  try {
    const adminConfig = {
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    };

    admin.initializeApp({
      credential: admin.credential.cert(adminConfig),
    });

    adminDb = admin.firestore();
    adminAuth = admin.auth();
    console.log('Firebase Admin SDK inizializzato con successo.');
  } catch (error) {
    console.error('ERRORE CRITICO: Impossibile inizializzare Firebase Admin SDK.', error);
  }
} else if (admin.apps.length > 0) {
    // Se l'app è già inizializzata, prendi semplicemente le istanze.
    adminDb = admin.firestore();
    adminAuth = admin.auth();
}

// Esporta tutte le istanze per usarle negli altri servizi
export { db, auth, adminDb, adminAuth };