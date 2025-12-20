require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function testInvioNotificaPush() {
  console.log('🧪 TEST INVIO NOTIFICA PUSH\n');
  console.log('='.repeat(60));
  
  try {
    // 1. Verifica utente con token FCM reale
    console.log('\n📊 TEST 1: Verifica Utente con Token FCM Reale\n');
    const utenteResult = await pool.query(`
      SELECT 
        id,
        email,
        notifiche_preferenze->>'demos' as demos,
        fcm_tokens,
        array_length(fcm_tokens, 1) as token_count
      FROM users 
      WHERE email = 'nicolasmicheletti90@gmail.com'
      LIMIT 1
    `);
    
    if (utenteResult.rows.length === 0) {
      console.log('❌ Utente non trovato');
      return;
    }
    
    const utente = utenteResult.rows[0];
    console.log(`✅ Utente trovato: ${utente.email}`);
    console.log(`   demos: ${utente.demos || 'false'}`);
    console.log(`   Token count: ${utente.token_count || 0}`);
    
    const tokens = utente.fcm_tokens || [];
    const realTokens = tokens.filter(t => t.length > 100 && !t.startsWith('web_'));
    
    if (realTokens.length === 0) {
      console.log('❌ Nessun token FCM reale trovato per questo utente');
      console.log('   Token trovati:', tokens);
      return;
    }
    
    console.log(`✅ Token FCM reali trovati: ${realTokens.length}`);
    realTokens.forEach((token, index) => {
      console.log(`   Token ${index + 1}: ${token.substring(0, 30)}... (${token.length} caratteri)`);
    });
    
    // 2. Test invio notifica
    console.log('\n📊 TEST 2: Test Invio Notifica Push\n');
    
    const { getFirebaseAdmin } = require('./api/services/firebaseAdmin');
    const admin = getFirebaseAdmin();
    
    if (!admin) {
      console.log('❌ Firebase Admin non inizializzato');
      return;
    }
    
    console.log('✅ Firebase Admin disponibile');
    
    const testToken = realTokens[0];
    console.log(`\n🔔 Invio notifica di test a token: ${testToken.substring(0, 30)}...`);
    
    const message = {
      token: testToken,
      notification: {
        title: 'Test Notifica Push',
        body: 'Questa è una notifica di test per verificare che le push funzionino'
      },
      data: {
        type: 'test',
        url: '/comunica'
      },
      webpush: {
        headers: {
          'Urgency': 'high'
        },
        notification: {
          icon: '/icona.png',
          badge: '/icona.png',
          tag: 'test-notification',
          requireInteraction: true,
          data: {
            url: '/comunica',
            link: 'https://www.demos.community/comunica'
          },
          actions: [
            {
              action: 'open',
              title: 'Apri'
            },
            {
              action: 'close',
              title: 'Chiudi'
            }
          ]
        },
        fcmOptions: {
          link: 'https://www.demos.community/comunica'
        }
      }
    };
    
    try {
      console.log('📤 Invio notifica...');
      const response = await admin.messaging().send(message);
      console.log('✅ Notifica inviata con successo!');
      console.log(`   Message ID: ${response}`);
      console.log('\n💡 Verifica sul browser se la notifica è arrivata');
    } catch (error) {
      console.error('❌ Errore invio notifica:', error.message);
      console.error('   Code:', error.code);
      console.error('   Stack:', error.stack);
      
      if (error.code === 'messaging/invalid-registration-token') {
        console.error('\n⚠️ Il token FCM non è valido. Potrebbe essere scaduto o revocato.');
      } else if (error.code === 'messaging/registration-token-not-registered') {
        console.error('\n⚠️ Il token FCM non è registrato. L\'utente potrebbe aver revocato i permessi.');
      } else if (error.code === 'messaging/authentication-error') {
        console.error('\n⚠️ Errore di autenticazione Firebase. Verifica le credenziali.');
      }
    }
    
    // 3. Verifica utenti con demos: true e token FCM
    console.log('\n📊 TEST 3: Utenti con demos: true e Token FCM\n');
    const demosResult = await pool.query(`
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
    `);
    
    console.log(`✅ Trovati ${demosResult.rows.length} utenti con demos: true e token FCM`);
    
    let totalRealTokens = 0;
    demosResult.rows.forEach((user, index) => {
      const tokens = user.fcm_tokens || [];
      const realTokens = tokens.filter(t => t.length > 100 && !t.startsWith('web_'));
      totalRealTokens += realTokens.length;
      
      console.log(`\n${index + 1}. ${user.email || user.id}`);
      console.log(`   Token totali: ${tokens.length}`);
      console.log(`   Token FCM reali: ${realTokens.length}`);
      if (realTokens.length > 0) {
        console.log(`   Primo token: ${realTokens[0].substring(0, 30)}...`);
      }
    });
    
    console.log(`\n📊 TOTALE: ${totalRealTokens} token FCM reali trovati`);
    
    if (totalRealTokens === 0) {
      console.log('\n⚠️ Nessun token FCM reale trovato!');
      console.log('   Le notifiche push non possono essere inviate.');
    }
    
  } catch (error) {
    console.error('❌ Errore:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

testInvioNotificaPush()
  .then(() => {
    console.log('\n✅ Test completato');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Errore:', error);
    process.exit(1);
  });

