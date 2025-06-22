import admin from "firebase-admin";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// ==============================================================
// CONFIGURAZIONE FIREBASE ADMIN SDK (SOLO PER IL SERVER)
// ==============================================================
let adminDb = null;
let adminAuth = null;

if (admin.apps.length === 0) { 
  try {
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
      adminDb = admin.firestore();
      adminAuth = admin.auth();
      console.log('Firebase Admin SDK inizializzato con successo.');
    } else {
      console.warn('Credenziali Firebase Admin non trovate nei Secrets/variabili d\'ambiente. Admin SDK non sarà disponibile.');
    }
  } catch (error) {
    console.error('ERRORE CRITICO: Impossibile inizializzare Firebase Admin SDK.', error);
  }
} else {
  adminDb = admin.firestore();
  adminAuth = admin.auth();
}

// ==============================================================
// CONFIGURAZIONE FIREBASE CLIENT SDK (PER USO LATO SERVERLESS O CLIENT)
// ==============================================================
let db = null;
let auth = null;

try {
  let clientApp;
  if (getApps().length === 0) {
    // Cerca le variabili d'ambiente con e senza il prefisso VITE_ per compatibilità
    const firebaseConfig = {
      apiKey: process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY,
      authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN,
      projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID,
      storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.VITE_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID,
    };
    
    // Controlla che le credenziali esistano prima di inizializzare
    if (!firebaseConfig.apiKey) {
      throw new Error("API Key di Firebase non trovata nelle variabili d'ambiente.");
    }

    clientApp = initializeApp(firebaseConfig, 'client');
  } else {
    clientApp = getApps().find(app => app.name === 'client') || initializeApp(firebaseConfig, 'client');
  }
  db = getFirestore(clientApp);
  auth = getAuth(clientApp);
} catch (err) {
  console.warn('Impossibile inizializzare Firebase Client SDK:', err);
}

export { adminDb, adminAuth, db, auth }; 