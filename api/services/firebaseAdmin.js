/**
 * Servizio per inizializzare Firebase Admin SDK
 * Usato per inviare notifiche push FCM
 */

let admin = null;
let isInitialized = false;

function initializeFirebaseAdmin() {
  if (isInitialized && admin) {
    return admin;
  }

  try {
    // Prova a caricare firebase-admin
    admin = require('firebase-admin');
    
    // Verifica se Firebase è già inizializzato
    if (admin.apps.length > 0) {
      isInitialized = true;
      console.log('✅ Firebase Admin già inizializzato');
      return admin;
    }

    // PRIORITÀ 1: Usa variabili d'ambiente (come configurato su Render.com)
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      console.log('📝 Inizializzazione Firebase Admin con variabili d\'ambiente...');
      
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        })
      });

      isInitialized = true;
      console.log('✅ Firebase Admin inizializzato con successo (variabili d\'ambiente)');
      return admin;
    }

    // PRIORITÀ 2: Fallback al file serviceAccountKey.json
    const path = require('path');
    const fs = require('fs');
    
    // Prova diversi percorsi per il service account
    const possiblePaths = [
      path.join(__dirname, '../../serviceAccountKey.json'),
      path.join(__dirname, '../serviceAccountKey.json'),
      path.join(process.cwd(), 'serviceAccountKey.json'),
      process.env.FIREBASE_SERVICE_ACCOUNT_PATH
    ].filter(Boolean);

    let serviceAccountPath = null;
    for (const possiblePath of possiblePaths) {
      if (possiblePath && fs.existsSync(possiblePath)) {
        serviceAccountPath = possiblePath;
        break;
      }
    }

    if (serviceAccountPath) {
      console.log('📝 Inizializzazione Firebase Admin con file JSON...');
      const serviceAccount = require(serviceAccountPath);
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });

      isInitialized = true;
      console.log('✅ Firebase Admin inizializzato con successo (file JSON)');
      return admin;
    }

    // Nessun metodo di configurazione trovato
    console.warn('⚠️ Firebase Admin non configurato. Notifiche push non disponibili.');
    console.warn('⚠️ Configura FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY oppure serviceAccountKey.json');
    return null;
  } catch (error) {
    console.error('❌ Errore nell\'inizializzazione Firebase Admin:', error.message);
    console.error('❌ Stack:', error.stack);
    return null;
  }
}

function getFirebaseAdmin() {
  if (!isInitialized || !admin) {
    return initializeFirebaseAdmin();
  }
  return admin;
}

module.exports = {
  initializeFirebaseAdmin,
  getFirebaseAdmin,
  isInitialized: () => isInitialized && admin !== null
};

