import admin from "firebase-admin";

// ==============================================================
// CONFIGURAZIONE FIREBASE ADMIN SDK (SOLO PER IL SERVER)
// ==============================================================
let adminDb: admin.firestore.Firestore | null = null;
let adminAuth: admin.auth.Auth | null = null;

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

export { adminDb, adminAuth };