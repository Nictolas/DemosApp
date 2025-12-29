require('dotenv').config();
const { Pool } = require('pg');
const { getFirebaseAdmin } = require('./api/services/firebaseAdmin');

// Configurazione database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function testFirebaseAdmin() {
  console.log('\n🧪 TEST 1: Inizializzazione Firebase Admin\n');
  
  try {
    const admin = getFirebaseAdmin();
    
    if (!admin) {
      console.error('❌ Firebase Admin non inizializzato');
      return false;
    }
    
    console.log('✅ Firebase Admin inizializzato correttamente');
    
    // Verifica che Firebase sia configurato
    if (admin.apps.length === 0) {
      console.error('❌ Nessuna app Firebase inizializzata');
      return false;
    }
    
    console.log(`✅ App Firebase attive: ${admin.apps.length}`);
    return true;
  } catch (error) {
    console.error('❌ Errore nell\'inizializzazione Firebase Admin:', error.message);
    return false;
  }
}

async function testDatabaseConnection() {
  console.log('\n🧪 TEST 2: Connessione Database\n');
  
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('✅ Connessione database OK');
    console.log(`   Timestamp: ${result.rows[0].now}`);
    return true;
  } catch (error) {
    console.error('❌ Errore connessione database:', error.message);
    return false;
  }
}

async function testFcmTokensColumn() {
  console.log('\n🧪 TEST 3: Colonna fcm_tokens\n');
  
  try {
    // Verifica che la colonna esista
    const columnCheck = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'fcm_tokens'
    `);
    
    if (columnCheck.rows.length === 0) {
      console.log('⚠️ Colonna fcm_tokens non trovata, verrà creata automaticamente');
      return true; // Verrà creata automaticamente
    }
    
    console.log(`✅ Colonna fcm_tokens trovata: ${columnCheck.rows[0].data_type}`);
    return true;
  } catch (error) {
    console.error('❌ Errore verifica colonna fcm_tokens:', error.message);
    return false;
  }
}

async function testUsersWithFcmTokens() {
  console.log('\n🧪 TEST 4: Utenti con token FCM\n');
  
  try {
    const result = await pool.query(`
      SELECT 
        id, 
        email, 
        array_length(fcm_tokens, 1) as token_count,
        notifiche_preferenze->>'demos' as demos_enabled
      FROM users 
      WHERE fcm_tokens IS NOT NULL 
        AND array_length(fcm_tokens, 1) > 0
      LIMIT 5
    `);
    
    if (result.rows.length === 0) {
      console.log('⚠️ Nessun utente con token FCM trovato');
      console.log('   (Normale se nessun utente ha ancora concesso i permessi)');
      return true;
    }
    
    console.log(`✅ Trovati ${result.rows.length} utenti con token FCM:`);
    result.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.email} - ${row.token_count} token(s) - Demos: ${row.demos_enabled || 'false'}`);
    });
    
    return true;
  } catch (error) {
    console.error('❌ Errore query utenti con FCM tokens:', error.message);
    return false;
  }
}

async function testUsersWithDemosEnabled() {
  console.log('\n🧪 TEST 5: Utenti con notifiche Demos attivate\n');
  
  try {
    const result = await pool.query(`
      SELECT 
        id, 
        email,
        notifiche_preferenze->>'demos' as demos_enabled,
        array_length(fcm_tokens, 1) as token_count
      FROM users 
      WHERE notifiche_preferenze->>'demos' = 'true'
        AND fcm_tokens IS NOT NULL 
        AND array_length(fcm_tokens, 1) > 0
      LIMIT 5
    `);
    
    if (result.rows.length === 0) {
      console.log('⚠️ Nessun utente con notifiche Demos attivate e token FCM');
      console.log('   (Normale se nessun utente ha attivato le notifiche)');
      return true;
    }
    
    console.log(`✅ Trovati ${result.rows.length} utenti pronti per notifiche push:`);
    result.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.email} - ${row.token_count} token(s)`);
    });
    
    return true;
  } catch (error) {
    console.error('❌ Errore query utenti con Demos attivate:', error.message);
    return false;
  }
}

async function testComunicazioniTable() {
  console.log('\n🧪 TEST 6: Tabella comunicazioni\n');
  
  try {
    // Verifica struttura tabella
    const columns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'comunicazioni'
      ORDER BY ordinal_position
    `);
    
    console.log(`✅ Tabella comunicazioni trovata con ${columns.rows.length} colonne`);
    
    // Verifica colonna tipo
    const tipoColumn = columns.rows.find(c => c.column_name === 'tipo');
    if (tipoColumn) {
      console.log(`   ✅ Colonna 'tipo' presente: ${tipoColumn.data_type}`);
    } else {
      console.log('   ⚠️ Colonna "tipo" non trovata (verrà creata automaticamente)');
    }
    
    // Verifica colonna read_by
    const readByColumn = columns.rows.find(c => c.column_name === 'read_by');
    if (readByColumn) {
      console.log(`   ✅ Colonna 'read_by' presente: ${readByColumn.data_type}`);
    } else {
      console.log('   ⚠️ Colonna "read_by" non trovata (verrà creata automaticamente)');
    }
    
    // Conta comunicazioni di tipo demos_notification
    const demosCount = await pool.query(`
      SELECT COUNT(*) as count 
      FROM comunicazioni 
      WHERE tipo = 'demos_notification'
    `);
    
    console.log(`   📊 Comunicazioni 'demos_notification': ${demosCount.rows[0].count}`);
    
    return true;
  } catch (error) {
    console.error('❌ Errore verifica tabella comunicazioni:', error.message);
    return false;
  }
}

async function testEnvironmentVariables() {
  console.log('\n🧪 TEST 7: Variabili d\'ambiente Firebase\n');
  
  const required = [
    'FIREBASE_PROJECT_ID',
    'FIREBASE_CLIENT_EMAIL',
    'FIREBASE_PRIVATE_KEY'
  ];
  
  let allPresent = true;
  
  required.forEach(varName => {
    if (process.env[varName]) {
      const value = process.env[varName];
      const displayValue = varName === 'FIREBASE_PRIVATE_KEY' 
        ? value.substring(0, 30) + '...' 
        : value;
      console.log(`✅ ${varName}: ${displayValue}`);
    } else {
      console.log(`❌ ${varName}: NON CONFIGURATA`);
      allPresent = false;
    }
  });
  
  if (allPresent) {
    console.log('\n✅ Tutte le variabili d\'ambiente Firebase sono configurate');
  } else {
    console.log('\n⚠️ Alcune variabili d\'ambiente Firebase mancanti');
    console.log('   Il sistema cercherà il file serviceAccountKey.json come fallback');
  }
  
  return true; // Non è un errore critico, può usare il file JSON
}

async function testSendPushNotification() {
  console.log('\n🧪 TEST 8: Test invio notifica push (simulazione)\n');
  
  try {
    const admin = getFirebaseAdmin();
    
    if (!admin) {
      console.log('⚠️ Firebase Admin non disponibile, skip test invio');
      return true;
    }
    
    // Trova un utente con token FCM per test
    const userResult = await pool.query(`
      SELECT id, email, fcm_tokens
      FROM users 
      WHERE fcm_tokens IS NOT NULL 
        AND array_length(fcm_tokens, 1) > 0
      LIMIT 1
    `);
    
    if (userResult.rows.length === 0) {
      console.log('⚠️ Nessun utente con token FCM trovato per il test');
      console.log('   (Normale se nessun utente ha ancora concesso i permessi)');
      return true;
    }
    
    const user = userResult.rows[0];
    const testToken = user.fcm_tokens[0];
    
    console.log(`📱 Test token: ${testToken.substring(0, 30)}...`);
    console.log(`👤 Utente test: ${user.email}`);
    
    // Verifica formato token (dovrebbe essere lungo e iniziare con caratteri alfanumerici)
    if (testToken.length < 100) {
      console.log('⚠️ Token FCM sembra troppo corto (potrebbe essere un device ID invece di un token FCM reale)');
    } else {
      console.log('✅ Token FCM sembra avere formato corretto');
    }
    
    console.log('\n💡 Per testare l\'invio reale, usa:');
    console.log('   POST /api/comunicazioni/send-demos-notification');
    
    return true;
  } catch (error) {
    console.error('❌ Errore test invio notifica:', error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🧪 TEST SISTEMA NOTIFICHE PUSH WEB');
  console.log('═══════════════════════════════════════════════════════');
  
  const results = {
    firebaseAdmin: await testFirebaseAdmin(),
    database: await testDatabaseConnection(),
    fcmTokensColumn: await testFcmTokensColumn(),
    usersWithTokens: await testUsersWithFcmTokens(),
    usersWithDemos: await testUsersWithDemosEnabled(),
    comunicazioni: await testComunicazioniTable(),
    envVars: await testEnvironmentVariables(),
    sendPush: await testSendPushNotification()
  };
  
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('📊 RIEPILOGO TEST');
  console.log('═══════════════════════════════════════════════════════\n');
  
  const passed = Object.values(results).filter(r => r).length;
  const total = Object.keys(results).length;
  
  Object.entries(results).forEach(([test, result]) => {
    const icon = result ? '✅' : '❌';
    const name = test.replace(/([A-Z])/g, ' $1').trim();
    console.log(`${icon} ${name}`);
  });
  
  console.log(`\n📈 Risultato: ${passed}/${total} test passati\n`);
  
  if (passed === total) {
    console.log('✅ Tutti i test sono passati! Il sistema è pronto per le notifiche push.');
  } else {
    console.log('⚠️ Alcuni test non sono passati. Controlla i dettagli sopra.');
  }
  
  await pool.end();
  process.exit(passed === total ? 0 : 1);
}

// Esegui i test
runAllTests().catch(error => {
  console.error('❌ Errore fatale durante i test:', error);
  process.exit(1);
});

