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
function initializeAdmin() {
  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
    console.error("ERRORE FATALE: Variabili d'ambiente per Firebase Admin mancanti.");
    return null; 
  }

  try {
    if (admin.apps.length > 0) {
      return admin.app();
    }
    return admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
  } catch (error) {
    console.error("ERRORE CRITICO INIZIALIZZAZIONE ADMIN:", error);
    return null;
  }
}

const adminApp = initializeAdmin();

const adminDb = adminApp ? admin.firestore(adminApp) : null;
const adminAuth = adminApp ? admin.auth(adminApp) : null;

if (!adminDb) {
  console.warn("ATTENZIONE: 'adminDb' è null. Inizializzazione fallita.");
}

// Esporta tutte le istanze per usarle negli altri servizi
export { db, auth, adminDb, adminAuth };