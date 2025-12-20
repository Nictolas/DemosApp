require('dotenv').config();
const { Pool } = require('pg');

// Configurazione database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Configurazione Firebase Admin
let firebaseAdmin = null;
try {
  const { getFirebaseAdmin } = require('./api/services/firebaseAdmin');
  firebaseAdmin = getFirebaseAdmin();
} catch (error) {
  console.error('❌ Errore caricamento Firebase Admin:', error.message);
}

async function testCompletoFCM() {
  console.log('🧪 TEST COMPLETO SISTEMA FCM\n');
  console.log('='.repeat(60));
  
  // TEST 1: Verifica variabili d'ambiente backend
  console.log('\n📊 TEST 1: Variabili d\'ambiente Backend\n');
  const backendVars = {
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || 'MANCANTE',
    FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL ? 'PRESENTE' : 'MANCANTE',
    FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY ? 'PRESENTE' : 'MANCANTE',
    DATABASE_URL: process.env.DATABASE_URL ? 'PRESENTE' : 'MANCANTE'
  };
  
  console.log('Variabili backend:');
  Object.entries(backendVars).forEach(([key, value]) => {
    const status = value === 'MANCANTE' ? '❌' : '✅';
    console.log(`  ${status} ${key}: ${value}`);
  });
  
  // TEST 2: Verifica Firebase Admin
  console.log('\n📊 TEST 2: Firebase Admin SDK\n');
  if (firebaseAdmin) {
    console.log('✅ Firebase Admin inizializzato');
    console.log(`   App Firebase attive: ${firebaseAdmin.apps.length}`);
    if (firebaseAdmin.apps.length > 0) {
      const app = firebaseAdmin.apps[0];
      console.log(`   Project ID: ${app.options.projectId}`);
    }
  } else {
    console.log('❌ Firebase Admin NON inizializzato');
  }
  
  // TEST 3: Verifica database
  console.log('\n📊 TEST 3: Database Neon\n');
  let client;
  try {
    client = await pool.connect();
    console.log('✅ Connessione database OK');
    
    // Verifica struttura tabella users
    const usersTable = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
        AND column_name IN ('fcm_tokens', 'notifiche_preferenze')
      ORDER BY column_name
    `);
    
    console.log('\nColonne rilevanti in users:');
    usersTable.rows.forEach(row => {
      console.log(`  ✅ ${row.column_name}: ${row.data_type}`);
    });
    
    if (usersTable.rows.length < 2) {
      console.log('  ⚠️ Alcune colonne potrebbero mancare');
    }
    
  } catch (err) {
    console.error('❌ Errore connessione database:', err.message);
  } finally {
    if (client) client.release();
  }
  
  // TEST 4: Verifica utenti con token FCM
  console.log('\n📊 TEST 4: Utenti con Token FCM\n');
  try {
    const utentiResult = await pool.query(`
      SELECT 
        id,
        email,
        notifiche_preferenze->>'demos' as demos,
        fcm_tokens,
        array_length(fcm_tokens, 1) as token_count
      FROM users 
      WHERE fcm_tokens IS NOT NULL 
        AND array_length(fcm_tokens, 1) > 0
      LIMIT 10
    `);
    
    console.log(`Trovati ${utentiResult.rows.length} utenti con token FCM\n`);
    
    if (utentiResult.rows.length === 0) {
      console.log('⚠️ Nessun utente con token FCM trovato');
      console.log('   Questo è normale se gli utenti non hanno ancora concesso i permessi');
    } else {
      let tokenReali = 0;
      let deviceIdFittizi = 0;
      
      utentiResult.rows.forEach((user, index) => {
        console.log(`${index + 1}. ${user.email || user.id}`);
        console.log(`   demos: ${user.demos || 'false'}`);
        console.log(`   Token count: ${user.token_count}`);
        
        const tokens = user.fcm_tokens || [];
        tokens.forEach((token, tokenIndex) => {
          const isRealToken = token.length > 100 && !token.startsWith('web_');
          
          if (isRealToken) {
            tokenReali++;
            console.log(`   ✅ Token ${tokenIndex + 1}: FCM REALE (${token.length} caratteri)`);
            console.log(`      Inizio: ${token.substring(0, 30)}...`);
          } else {
            deviceIdFittizi++;
            console.log(`   ❌ Token ${tokenIndex + 1}: DEVICE ID FITTIZIO`);
            console.log(`      Valore: ${token}`);
            console.log(`      Questo token NON funzionerà per le notifiche push!`);
          }
        });
        console.log('');
      });
      
      console.log(`\n📊 STATISTICHE:`);
      console.log(`   ✅ Token FCM reali: ${tokenReali}`);
      console.log(`   ❌ Device ID fittizi: ${deviceIdFittizi}`);
      
      if (tokenReali === 0) {
        console.log('\n❌ PROBLEMA CRITICO: Nessun token FCM reale trovato!');
        console.log('   Causa: Firebase non è configurato correttamente nel frontend');
        console.log('   O le variabili VITE_FIREBASE_* non sono disponibili durante il build');
      }
    }
  } catch (err) {
    console.error('❌ Errore query utenti:', err.message);
  }
  
  // TEST 5: Verifica utenti con demos: true
  console.log('\n📊 TEST 5: Utenti con notifiche Demos attive\n');
  try {
    const demosResult = await pool.query(`
      SELECT 
        id,
        email,
        notifiche_preferenze->>'demos' as demos,
        fcm_tokens,
        array_length(fcm_tokens, 1) as token_count
      FROM users 
      WHERE notifiche_preferenze->>'demos' = 'true'
      LIMIT 10
    `);
    
    console.log(`Trovati ${demosResult.rows.length} utenti con demos: true\n`);
    
    if (demosResult.rows.length === 0) {
      console.log('⚠️ Nessun utente con notifiche Demos attive');
    } else {
      const conToken = demosResult.rows.filter(u => 
        u.fcm_tokens && u.token_count > 0
      );
      const senzaToken = demosResult.rows.filter(u => 
        !u.fcm_tokens || u.token_count === 0
      );
      
      console.log(`   ✅ Con token FCM: ${conToken.length}`);
      console.log(`   ❌ Senza token FCM: ${senzaToken.length}`);
      
      if (senzaToken.length > 0) {
        console.log('\n⚠️ Utenti con demos: true ma senza token FCM:');
        senzaToken.forEach(u => {
          console.log(`   - ${u.email || u.id}`);
        });
      }
    }
  } catch (err) {
    console.error('❌ Errore query demos:', err.message);
  }
  
  // TEST 6: Test invio notifica (simulato)
  console.log('\n📊 TEST 6: Test Invio Notifica (Simulato)\n');
  if (firebaseAdmin) {
    try {
      // Trova un utente con token FCM reale
      const testUser = await pool.query(`
        SELECT id, email, fcm_tokens
        FROM users 
        WHERE fcm_tokens IS NOT NULL 
          AND array_length(fcm_tokens, 1) > 0
          AND notifiche_preferenze->>'demos' = 'true'
        LIMIT 1
      `);
      
      if (testUser.rows.length > 0) {
        const user = testUser.rows[0];
        const tokens = user.fcm_tokens || [];
        const realTokens = tokens.filter(t => t.length > 100 && !t.startsWith('web_'));
        
        if (realTokens.length > 0) {
          console.log(`✅ Utente di test trovato: ${user.email || user.id}`);
          console.log(`   Token FCM reali: ${realTokens.length}`);
          console.log(`   Primo token: ${realTokens[0].substring(0, 30)}...`);
          
          // Prova a inviare una notifica di test
          try {
            const message = {
              notification: {
                title: 'Test Notifica',
                body: 'Questa è una notifica di test'
              },
              token: realTokens[0],
              webpush: {
                fcmOptions: {
                  link: 'https://www.demos.community/comunica'
                }
              }
            };
            
            console.log('\n🔔 Tentativo invio notifica di test...');
            const response = await firebaseAdmin.messaging().send(message);
            console.log('✅ Notifica inviata con successo!');
            console.log(`   Message ID: ${response}`);
          } catch (sendError) {
            console.error('❌ Errore invio notifica:', sendError.message);
            if (sendError.code === 'messaging/invalid-registration-token') {
              console.error('   Il token FCM non è valido. Potrebbe essere scaduto o revocato.');
            } else if (sendError.code === 'messaging/registration-token-not-registered') {
              console.error('   Il token FCM non è registrato. L\'utente potrebbe aver revocato i permessi.');
            }
          }
        } else {
          console.log('⚠️ Utente trovato ma solo con device ID fittizi');
          console.log('   Non posso testare l\'invio notifiche senza token FCM reali');
        }
      } else {
        console.log('⚠️ Nessun utente con token FCM reale e demos: true trovato');
        console.log('   Non posso testare l\'invio notifiche');
      }
    } catch (err) {
      console.error('❌ Errore test invio:', err.message);
    }
  } else {
    console.log('⚠️ Firebase Admin non inizializzato, salto test invio');
  }
  
  // TEST 7: Verifica configurazione frontend (simulata)
  console.log('\n📊 TEST 7: Configurazione Frontend (Verifica Manuale)\n');
  console.log('⚠️ Questo test richiede verifica manuale nel browser\n');
  console.log('Passi da seguire:');
  console.log('1. Apri https://www.demos.community');
  console.log('2. Apri la console del browser (F12)');
  console.log('3. Cerca questi log:');
  console.log('   - 🔧 Configurazione Firebase FCM:');
  console.log('   - 🔑 VAPID Key check:');
  console.log('   - ✅ Token FCM ottenuto:');
  console.log('\n4. Se vedi "vapidKey: MANCANTE":');
  console.log('   → La variabile VITE_FIREBASE_VAPID_KEY non è disponibile durante il build');
  console.log('   → Verifica su Render.com che sia presente');
  console.log('   → Rideploya il frontend');
  console.log('\n5. Se vedi "Request is missing required authentication credential":');
  console.log('   → La VAPID key potrebbe non essere corretta');
  console.log('   → Verifica che corrisponda esattamente a quella in Firebase Console');
  console.log('   → Verifica che "Firebase Cloud Messaging API" sia abilitata in Google Cloud Console');
  
  // Riepilogo finale
  console.log('\n' + '='.repeat(60));
  console.log('\n📋 RIEPILOGO FINALE\n');
  
  const problemi = [];
  
  if (!firebaseAdmin) {
    problemi.push('Firebase Admin non inizializzato');
  }
  
  if (!process.env.FIREBASE_PROJECT_ID) {
    problemi.push('FIREBASE_PROJECT_ID mancante nel backend');
  }
  
  if (!process.env.FIREBASE_CLIENT_EMAIL) {
    problemi.push('FIREBASE_CLIENT_EMAIL mancante nel backend');
  }
  
  if (!process.env.FIREBASE_PRIVATE_KEY) {
    problemi.push('FIREBASE_PRIVATE_KEY mancante nel backend');
  }
  
  if (problemi.length === 0) {
    console.log('✅ Backend configurato correttamente');
  } else {
    console.log('❌ Problemi trovati nel backend:');
    problemi.forEach(p => console.log(`   - ${p}`));
  }
  
  console.log('\n💡 PROSSIMI PASSI:');
  console.log('1. Verifica che tutte le variabili VITE_FIREBASE_* siano presenti su Render.com (demos-frontend)');
  console.log('2. Verifica che la VAPID key su Render.com corrisponda esattamente a quella in Firebase Console');
  console.log('3. Rideploya il frontend su Render.com');
  console.log('4. Apri la webapp e controlla la console del browser per i log di debug');
  console.log('5. Se vedi ancora errori, verifica che "Firebase Cloud Messaging API" sia abilitata in Google Cloud Console');
  
  await pool.end();
}

testCompletoFCM()
  .then(() => {
    console.log('\n✅ Test completato');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Errore:', error);
    process.exit(1);
  });

