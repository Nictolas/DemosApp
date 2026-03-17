require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function verificaPushNotifiche() {
  console.log('🔍 VERIFICA SISTEMA PUSH NOTIFICHE\n');
  
  try {
    // 1. Verifica utenti con demos: true e token FCM
    console.log('📊 TEST 1: Utenti con demos: true e token FCM\n');
    const utentiResult = await pool.query(`
      SELECT 
        id, 
        email,
        notifiche_preferenze->>'demos' as demos,
        fcm_tokens,
        array_length(fcm_tokens, 1) as token_count
      FROM users 
      WHERE notifiche_preferenze->>'demos' = 'true'
        AND fcm_tokens IS NOT NULL 
        AND array_length(fcm_tokens, 1) > 0
      LIMIT 10
    `);
    
    console.log(`✅ Trovati ${utentiResult.rows.length} utenti con demos: true e token FCM\n`);
    
    if (utentiResult.rows.length === 0) {
      console.log('❌ PROBLEMA: Nessun utente con token FCM trovato!');
      console.log('   Questo significa che le notifiche push NON possono essere inviate.\n');
      return;
    }
    
    // Analizza i token
    let tokenReali = 0;
    let deviceIdFittizi = 0;
    
    utentiResult.rows.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email || user.id}`);
      console.log(`   Token count: ${user.token_count}`);
      
      const tokens = user.fcm_tokens || [];
      tokens.forEach((token, tokenIndex) => {
        // I token FCM reali sono molto lunghi (circa 150+ caratteri) e iniziano con caratteri alfanumerici
        // I device ID fittizi iniziano con "web_" e sono più corti
        const isRealToken = token.length > 100 && !token.startsWith('web_');
        
        if (isRealToken) {
          tokenReali++;
          console.log(`   ✅ Token ${tokenIndex + 1}: FCM REALE (${token.length} caratteri)`);
        } else {
          deviceIdFittizi++;
          console.log(`   ❌ Token ${tokenIndex + 1}: DEVICE ID FITTIZIO (${token.substring(0, 30)}...)`);
          console.log(`      Questo token NON funzionerà per le notifiche push!`);
        }
      });
      console.log('');
    });
    
    console.log(`\n📊 STATISTICHE TOKEN:`);
    console.log(`   ✅ Token FCM reali: ${tokenReali}`);
    console.log(`   ❌ Device ID fittizi: ${deviceIdFittizi}`);
    
    if (deviceIdFittizi > 0) {
      console.log(`\n⚠️ PROBLEMA: Ci sono ${deviceIdFittizi} device ID fittizi che NON funzioneranno!`);
      console.log(`   Causa: Firebase non è configurato correttamente nel frontend o Service Worker non funziona`);
    }
    
    if (tokenReali === 0) {
      console.log(`\n❌ PROBLEMA CRITICO: Nessun token FCM reale trovato!`);
      console.log(`   Le notifiche push NON funzioneranno finché non ci sono token FCM reali.`);
      console.log(`\n💡 SOLUZIONE:`);
      console.log(`   1. Verifica che le variabili VITE_FIREBASE_* siano configurate nel frontend`);
      console.log(`   2. Verifica che il Service Worker firebase-messaging-sw.js sia aggiornato con le credenziali`);
      console.log(`   3. Gli utenti devono riaprire la webapp e concedere i permessi per le notifiche`);
      console.log(`   4. Il token FCM reale verrà generato e salvato automaticamente`);
    }
    
    // 2. Verifica ultime comunicazioni Demos
    console.log('\n📊 TEST 2: Ultime comunicazioni Demos\n');
    const comunicazioniResult = await pool.query(`
      SELECT 
        id,
        titolo,
        testo,
        tipo,
        data_creazione,
        array_length(read_by, 1) as read_count
      FROM comunicazioni 
      WHERE tipo = 'demos_notification'
      ORDER BY data_creazione DESC
      LIMIT 5
    `);
    
    console.log(`✅ Trovate ${comunicazioniResult.rows.length} comunicazioni Demos\n`);
    comunicazioniResult.rows.forEach((com, index) => {
      console.log(`${index + 1}. ${com.titolo}`);
      console.log(`   Data: ${com.data_creazione}`);
      console.log(`   Lette da: ${com.read_count || 0} utenti`);
      console.log('');
    });
    
    // 3. Verifica Firebase Admin
    console.log('📊 TEST 3: Firebase Admin SDK\n');
    try {
      const { getFirebaseAdmin } = require('./api/services/firebaseAdmin');
      const admin = getFirebaseAdmin();
      
      if (admin) {
        console.log('✅ Firebase Admin inizializzato correttamente');
        console.log(`   App Firebase attive: ${admin.apps.length}`);
      } else {
        console.log('❌ Firebase Admin NON inizializzato');
        console.log('   Verifica FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY');
      }
    } catch (error) {
      console.log('❌ Errore verifica Firebase Admin:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Errore:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

verificaPushNotifiche()
  .then(() => {
    console.log('\n✅ Verifica completata');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Errore:', error);
    process.exit(1);
  });

