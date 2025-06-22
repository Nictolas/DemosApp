import admin from "firebase-admin";
import { initializeApp, getApps, FirebaseApp } from "firebase/app";
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
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\n/g, '\n'),
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
    clientApp = initializeApp({
      apiKey: process.env.FIREBASE_API_KEY,
      authDomain: process.env.FIREBASE_AUTH_DOMAIN,
      projectId: process.env.FIREBASE_PROJECT_ID,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.FIREBASE_APP_ID,
    }, 'client');
  } else {
    clientApp = getApps().find(app => app.name === 'client');
  }
  db = getFirestore(clientApp);
  auth = getAuth(clientApp);
} catch (err) {
  console.warn('Impossibile inizializzare Firebase Client SDK:', err);
}

export { adminDb, adminAuth, db, auth }; 