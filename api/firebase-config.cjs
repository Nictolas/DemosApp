const admin = require("firebase-admin");

// DEBUG: Log variabili d'ambiente Firebase
console.log("FIREBASE_PROJECT_ID:", process.env.FIREBASE_PROJECT_ID);
console.log("FIREBASE_CLIENT_EMAIL:", process.env.FIREBASE_CLIENT_EMAIL);
console.log("FIREBASE_PRIVATE_KEY exists:", !!process.env.FIREBASE_PRIVATE_KEY);
console.log("FIREBASE_PRIVATE_KEY preview:", process.env.FIREBASE_PRIVATE_KEY?.slice(0, 30));

// ==============================================================
// CONFIGURAZIONE FIREBASE ADMIN SDK (SOLO PER L'AUTENTICAZIONE)
// ==============================================================
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
      adminAuth = admin.auth();
      console.log('Firebase Admin SDK inizializzato con successo (solo autenticazione).');
    } else {
      console.warn('Credenziali Firebase Admin non trovate nei Secrets/variabili d\'ambiente. Admin SDK non sarà disponibile.');
    }
  } catch (error) {
    console.error('ERRORE CRITICO: Impossibile inizializzare Firebase Admin SDK.', error);
  }
} else {
  adminAuth = admin.auth();
}

// Esporto solo l'autenticazione, non più Firestore
module.exports = { adminAuth };
