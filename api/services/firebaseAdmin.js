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

    // Usa solo variabili d'ambiente (come configurato su Render.com)
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKeyRaw) {
      console.warn('⚠️ Firebase Admin non configurato. Notifiche push non disponibili.');
      console.warn('⚠️ Variabili richieste: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY');
      return null;
    }

    // Pulisci la chiave privata: rimuovi virgolette iniziali/finali e converti \n
    let privateKey = privateKeyRaw.trim();
    if (
      (privateKey.startsWith('"') && privateKey.endsWith('"')) ||
      (privateKey.startsWith("'") && privateKey.endsWith("'"))
    ) {
      privateKey = privateKey.slice(1, -1);
    }
    privateKey = privateKey.replace(/\\\\n/g, '\n').replace(/\\n/g, '\n');

    if (privateKey.length < 1000) {
      throw new Error(
        `FIREBASE_PRIVATE_KEY troppo corta (${privateKey.length} caratteri). Verifica che su Render sia completa e non troncata.`
      );
    }

    const credential = admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    });

    admin.initializeApp({ credential });

    isInitialized = true;
    console.log('✅ Firebase Admin inizializzato con successo (env)');
    return admin;
  } catch (error) {
    console.error('❌ Errore nell\'inizializzazione Firebase Admin:', error.message);
    console.error('❌ Stack:', error.stack);
    return null;
  }
}

function getFirebaseAdmin() {
  // Se non è inizializzato, prova a inizializzarlo
  if (!isInitialized || !admin) {
    console.log('🔄 getFirebaseAdmin: Firebase Admin non inizializzato, tentativo di inizializzazione...');
    const result = initializeFirebaseAdmin();
    if (!result) {
      console.error('❌ getFirebaseAdmin: Firebase Admin non disponibile dopo tentativo di inizializzazione');
      console.error('❌ Verifica le variabili d\'ambiente su Render.com:');
      console.error('   - FIREBASE_PROJECT_ID');
      console.error('   - FIREBASE_CLIENT_EMAIL');
      console.error('   - FIREBASE_PRIVATE_KEY (deve essere la chiave completa senza virgolette)');
    }
    return result;
  }
  return admin;
}

module.exports = {
  initializeFirebaseAdmin,
  getFirebaseAdmin,
  isInitialized: () => isInitialized && admin !== null
};

