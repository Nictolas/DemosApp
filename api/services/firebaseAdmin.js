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
    const hasProjectId = !!process.env.FIREBASE_PROJECT_ID;
    const hasClientEmail = !!process.env.FIREBASE_CLIENT_EMAIL;
    const hasPrivateKey = !!process.env.FIREBASE_PRIVATE_KEY;
    
    console.log('🔍 Verifica variabili d\'ambiente Firebase:');
    console.log(`   FIREBASE_PROJECT_ID: ${hasProjectId ? '✅ Presente' : '❌ Mancante'}${hasProjectId ? ` (${process.env.FIREBASE_PROJECT_ID})` : ''}`);
    console.log(`   FIREBASE_CLIENT_EMAIL: ${hasClientEmail ? '✅ Presente' : '❌ Mancante'}${hasClientEmail ? ` (${process.env.FIREBASE_CLIENT_EMAIL.substring(0, 30)}...)` : ''}`);
    console.log(`   FIREBASE_PRIVATE_KEY: ${hasPrivateKey ? '✅ Presente' : '❌ Mancante'}${hasPrivateKey ? ` (lunghezza: ${process.env.FIREBASE_PRIVATE_KEY.length} caratteri)` : ''}`);
    
    if (hasProjectId && hasClientEmail && hasPrivateKey) {
      console.log('📝 Inizializzazione Firebase Admin con variabili d\'ambiente...');
      
      try {
        // Pulisci la chiave privata: rimuovi virgolette iniziali/finali e converti \n
        let privateKey = process.env.FIREBASE_PRIVATE_KEY;
        
        // Rimuovi virgolette iniziali e finali se presenti
        privateKey = privateKey.replace(/^["']|["']$/g, '');
        
        // Converti \n letterali in newline reali
        privateKey = privateKey.replace(/\\n/g, '\n');
        
        // Verifica che la chiave inizi e finisca correttamente
        if (!privateKey.includes('BEGIN PRIVATE KEY')) {
          console.warn('⚠️ La chiave privata potrebbe non essere formattata correttamente (manca BEGIN PRIVATE KEY)');
        }
        
        console.log(`   Chiave privata pulita: ${privateKey.length} caratteri`);
        console.log(`   Inizia con: ${privateKey.substring(0, 30)}...`);
        console.log(`   Finisce con: ...${privateKey.substring(privateKey.length - 30)}`);
        
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: privateKey,
          })
        });

        isInitialized = true;
        console.log('✅ Firebase Admin inizializzato con successo (variabili d\'ambiente)');
        console.log(`   Project ID: ${process.env.FIREBASE_PROJECT_ID}`);
        return admin;
      } catch (initError) {
        console.error('❌ Errore durante l\'inizializzazione Firebase Admin:');
        console.error(`   Message: ${initError.message}`);
        console.error(`   Code: ${initError.code || 'N/A'}`);
        if (initError.stack) {
          console.error(`   Stack: ${initError.stack}`);
        }
        return null;
      }
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

