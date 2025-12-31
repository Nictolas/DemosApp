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
        
        console.log(`   Chiave privata RAW (lunghezza totale): ${privateKey.length} caratteri`);
        console.log(`   Chiave privata RAW (primi 50 caratteri): ${privateKey.substring(0, 50)}...`);
        console.log(`   Chiave privata RAW (ultimi 50 caratteri): ...${privateKey.substring(privateKey.length - 50)}`);
        console.log(`   Chiave privata RAW contiene \\n letterali: ${privateKey.includes('\\n')}`);
        console.log(`   Chiave privata RAW contiene \\\\n (doppio backslash): ${privateKey.includes('\\\\n')}`);
        console.log(`   Chiave privata RAW inizia con ": ${privateKey.startsWith('"')}`);
        console.log(`   Chiave privata RAW finisce con ": ${privateKey.endsWith('"')}`);
        console.log(`   Chiave privata RAW contiene spazi iniziali/finali: ${privateKey !== privateKey.trim()}`);
        
        // Rimuovi virgolette iniziali e finali se presenti (sia singole che doppie)
        privateKey = privateKey.trim();
        if ((privateKey.startsWith('"') && privateKey.endsWith('"')) || 
            (privateKey.startsWith("'") && privateKey.endsWith("'"))) {
          privateKey = privateKey.slice(1, -1);
          console.log(`   ✅ Rimosse virgolette iniziali/finali`);
        }
        
        // Converti \n letterali in newline reali (gestisci sia \\n che \n)
        const beforeReplace = privateKey;
        // Prima prova con \\n (doppio backslash + n, come nel JSON)
        privateKey = privateKey.replace(/\\\\n/g, '\n');
        // Poi prova con \n (singolo backslash + n, se presente)
        privateKey = privateKey.replace(/\\n/g, '\n');
        if (beforeReplace !== privateKey) {
          console.log(`   ✅ Convertiti \\n letterali in newline reali`);
          console.log(`   📊 Newline convertite: ${(privateKey.match(/\n/g) || []).length} newline reali trovate`);
        } else {
          console.log(`   ⚠️ Nessun \\n trovato da convertire - la chiave potrebbe già avere newline reali o essere malformata`);
        }
        
        // Verifica che la chiave inizi e finisca correttamente
        if (!privateKey.includes('BEGIN PRIVATE KEY')) {
          console.warn('⚠️ La chiave privata potrebbe non essere formattata correttamente (manca BEGIN PRIVATE KEY)');
        }
        if (!privateKey.includes('END PRIVATE KEY')) {
          console.warn('⚠️ La chiave privata potrebbe non essere formattata correttamente (manca END PRIVATE KEY)');
        }
        
        console.log(`   Chiave privata pulita: ${privateKey.length} caratteri`);
        console.log(`   Inizia con: ${privateKey.substring(0, 30)}...`);
        console.log(`   Finisce con: ...${privateKey.substring(privateKey.length - 30)}`);
        console.log(`   Contiene newline reali: ${privateKey.includes('\n')}`);
        console.log(`   Numero di newline: ${(privateKey.match(/\n/g) || []).length}`);
        
        // Verifica che la chiave sia completa (dovrebbe essere ~1600+ caratteri)
        if (privateKey.length < 1000) {
          const errorMsg = `La chiave privata è troppo corta (${privateKey.length} caratteri). Una chiave RSA completa dovrebbe essere ~1600-1700 caratteri. La chiave potrebbe essere troncata su Render.com.`;
          console.error(`❌ ${errorMsg}`);
          throw new Error(errorMsg);
        }
        
        // Verifica che la chiave contenga almeno BEGIN e END
        if (!privateKey.includes('BEGIN PRIVATE KEY') || !privateKey.includes('END PRIVATE KEY')) {
          const errorMsg = `La chiave privata non contiene BEGIN PRIVATE KEY o END PRIVATE KEY. Formato non valido.`;
          console.error(`❌ ${errorMsg}`);
          console.error(`   Chiave dopo parsing (primi 100 caratteri): ${privateKey.substring(0, 100)}`);
          console.error(`   Chiave dopo parsing (ultimi 100 caratteri): ${privateKey.substring(privateKey.length - 100)}`);
          throw new Error(errorMsg);
        }
        
        // Verifica che la chiave inizi e finisca correttamente
        const startsCorrectly = privateKey.trim().startsWith('<REDACTED_PRIVATE_KEY>');
        
        if (!startsCorrectly || !endsCorrectly) {
          console.warn(`⚠️ La chiave potrebbe non essere formattata correttamente:`);
          console.warn(`   Inizia correttamente: ${startsCorrectly}`);
          console.warn(`   Finisce correttamente: ${endsCorrectly}`);
          console.warn(`   Primi 50 caratteri: ${privateKey.substring(0, 50)}`);
          console.warn(`   Ultimi 50 caratteri: ${privateKey.substring(privateKey.length - 50)}`);
        }
        
        console.log('🔧 Tentativo di inizializzazione Firebase Admin con credential.cert()...');
        console.log(`   Project ID: ${process.env.FIREBASE_PROJECT_ID}`);
        console.log(`   Client Email: ${process.env.FIREBASE_CLIENT_EMAIL}`);
        console.log(`   Private Key length: ${privateKey.length} caratteri`);
        console.log(`   Private Key inizia con: ${privateKey.substring(0, 30)}...`);
        console.log(`   Private Key finisce con: ...${privateKey.substring(privateKey.length - 30)}`);
        
        // Verifica che client_email corrisponda al formato atteso
        if (!process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_CLIENT_EMAIL.includes('@')) {
          console.error('❌ FIREBASE_CLIENT_EMAIL non valido o mancante');
          throw new Error('FIREBASE_CLIENT_EMAIL non valido');
        }
        
        if (!process.env.FIREBASE_CLIENT_EMAIL.includes('firebase-adminsdk')) {
          console.warn('⚠️ FIREBASE_CLIENT_EMAIL non sembra essere un Firebase Admin SDK service account');
        }
        
        try {
          const credential = admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: privateKey,
          });
          console.log('✅ Credential creata con successo');
          
          admin.initializeApp({
            credential: credential
          });
          
          console.log('✅ admin.initializeApp() completato');
          
          // Verifica che l'app sia stata inizializzata
          if (admin.apps.length === 0) {
            throw new Error('admin.apps.length è 0 dopo initializeApp()');
          }
          
          console.log(`✅ Firebase Admin inizializzato con successo (variabili d'ambiente)`);
          console.log(`   Project ID: ${process.env.FIREBASE_PROJECT_ID}`);
          console.log(`   App name: ${admin.apps[0].name}`);

      isInitialized = true;
      return admin;
        } catch (certError) {
          console.error('❌ Errore durante credential.cert() o initializeApp():');
          console.error(`   Error name: ${certError.name}`);
          console.error(`   Error message: ${certError.message}`);
          console.error(`   Error code: ${certError.code || 'N/A'}`);
          if (certError.stack) {
            console.error(`   Stack (primi 500 caratteri): ${certError.stack.substring(0, 500)}`);
          }
          
          // Crea un errore più descrittivo
          const detailedError = new Error(`Errore inizializzazione Firebase Admin: ${certError.message}`);
          detailedError.name = certError.name || 'FirebaseAdminInitError';
          detailedError.code = certError.code || 'INIT_ERROR';
          detailedError.originalError = certError.message;
          detailedError.privateKeyLength = privateKey.length;
          detailedError.privateKeyStartsWithBegin = privateKey.includes('BEGIN PRIVATE KEY');
          detailedError.privateKeyEndsWithEnd = privateKey.includes('END PRIVATE KEY');
          
          throw detailedError; // Rilancia per essere catturato dal catch esterno
        }
      } catch (initError) {
        console.error('❌ Errore durante l\'inizializzazione Firebase Admin:');
        console.error(`   Error name: ${initError.name || 'N/A'}`);
        console.error(`   Error message: ${initError.message}`);
        console.error(`   Error code: ${initError.code || 'N/A'}`);
        
        // Controlli specifici per errori comuni
        if (initError.message && initError.message.includes('private_key')) {
          console.error('   ⚠️ Errore relativo alla chiave privata - verifica il formato');
        }
        if (initError.message && initError.message.includes('PEM')) {
          console.error('   ⚠️ Errore formato PEM - la chiave potrebbe essere malformata o troncata');
        }
        if (initError.message && initError.message.includes('certificate')) {
          console.error('   ⚠️ Errore certificato - verifica projectId, clientEmail e privateKey');
        }
        
        if (initError.stack) {
          console.error(`   Stack (primi 800 caratteri): ${initError.stack.substring(0, 800)}`);
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

