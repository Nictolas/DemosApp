require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function verificaFCMTokens() {
  console.log('🔍 VERIFICA: Sistema FCM Tokens per Notifiche Push Mobile\n');
  
  let client;
  try {
    client = await pool.connect();
    console.log('✅ Connesso al database\n');

    // Verifica struttura tabella users
    console.log('📋 Verifica colonne nella tabella users');
    const columnsResult = await client.query(`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND (column_name LIKE '%fcm%' OR column_name LIKE '%token%')
      ORDER BY column_name
    `);
    
    console.log('Colonne FCM/token trovate:');
    if (columnsResult.rows.length === 0) {
      console.log('  ⚠️ Nessuna colonna FCM/token trovata!');
    } else {
      columnsResult.rows.forEach(row => {
        console.log(`  - ${row.column_name}: ${row.data_type} (${row.udt_name || 'N/A'})`);
      });
    }
    console.log('');

    // Verifica se esiste fcm_tokens
    const hasFcmTokens = columnsResult.rows.some(r => r.column_name === 'fcm_tokens');
    
    if (!hasFcmTokens) {
      console.log('⚠️ Colonna fcm_tokens NON trovata!');
      console.log('📝 Creazione colonna fcm_tokens...');
      
      try {
        await client.query(`
          ALTER TABLE users ADD COLUMN fcm_tokens TEXT[] DEFAULT ARRAY[]::TEXT[]
        `);
        console.log('✅ Colonna fcm_tokens creata con successo!\n');
      } catch (error) {
        console.error('❌ Errore nella creazione colonna:', error.message);
        console.log('');
      }
    } else {
      console.log('✅ Colonna fcm_tokens esiste già\n');
    }

    // Verifica utenti con token FCM
    console.log('👥 Verifica utenti con token FCM');
    const usersWithTokens = await client.query(`
      SELECT id, email, nome, cognome, 
             fcm_tokens, 
             array_length(fcm_tokens, 1) as token_count,
             notifiche_preferenze->>'demos' as demos_enabled
      FROM users 
      WHERE fcm_tokens IS NOT NULL 
        AND array_length(fcm_tokens, 1) > 0
      LIMIT 10
    `);
    
    console.log(`✅ Trovati ${usersWithTokens.rows.length} utenti con token FCM`);
    usersWithTokens.rows.forEach((u, i) => {
      console.log(`   ${i + 1}. ${u.email || u.id}`);
      console.log(`      Token FCM: ${u.token_count}`);
      console.log(`      Demos enabled: ${u.demos_enabled || 'false'}`);
      if (u.fcm_tokens && u.fcm_tokens.length > 0) {
        console.log(`      Primo token: ${u.fcm_tokens[0].substring(0, 30)}...`);
      }
    });
    console.log('');

    // Verifica utenti con demos: true
    console.log('🔔 Verifica utenti con demos: true');
    const usersWithDemos = await client.query(`
      SELECT id, email, nome, cognome,
             notifiche_preferenze->>'demos' as demos,
             fcm_tokens,
             array_length(fcm_tokens, 1) as token_count
      FROM users 
      WHERE notifiche_preferenze->>'demos' = 'true'
      LIMIT 10
    `);
    
    console.log(`✅ Trovati ${usersWithDemos.rows.length} utenti con demos: true`);
    const usersReadyForPush = usersWithDemos.rows.filter(u => (u.token_count || 0) > 0);
    console.log(`   Con token FCM: ${usersReadyForPush.length}`);
    console.log(`   Senza token FCM: ${usersWithDemos.rows.length - usersReadyForPush.length}`);
    
    if (usersReadyForPush.length === 0) {
      console.log('\n⚠️ PROBLEMA: Nessun utente ha sia demos: true che token FCM!');
      console.log('   Le notifiche push mobile NON verranno inviate.');
      console.log('   Gli utenti devono:');
      console.log('   1. Aprire l\'app sul cellulare');
      console.log('   2. Consentire le notifiche push');
      console.log('   3. Attivare "Notifiche Demos" nelle impostazioni');
    }
    console.log('');

    // Verifica Firebase Admin config
    console.log('🔥 Verifica configurazione Firebase Admin');
    try {
      const firebaseAdmin = require('./api/services/firebaseAdmin');
      const admin = firebaseAdmin.getFirebaseAdmin();
      
      if (admin) {
        console.log('✅ Firebase Admin configurato correttamente');
      } else {
        console.log('❌ Firebase Admin NON configurato');
        console.log('   Verifica che esista serviceAccountKey.json');
      }
    } catch (error) {
      console.log('❌ Errore nel caricamento Firebase Admin:', error.message);
    }
    console.log('');

    console.log('✅ VERIFICA COMPLETATA');
    
  } catch (error) {
    console.error('❌ ERRORE:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

verificaFCMTokens()
  .then(() => {
    console.log('\n🎉 Verifica completata');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Verifica fallita:', error);
    process.exit(1);
  });

