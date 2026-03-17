require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function verificaUtentiDemos() {
  console.log('🔍 VERIFICA UTENTI CON NOTIFICHE DEMOS ATTIVATE\n');
  
  try {
    // 1. Verifica utenti con demos: true
    console.log('📊 TEST 1: Utenti con notifiche_preferenze->>\'demos\' = \'true\'\n');
    const demosResult = await pool.query(`
      SELECT 
        id, 
        email, 
        nome,
        cognome,
        notifiche_preferenze,
        notifiche_preferenze->>'demos' as demos_value,
        fcm_tokens,
        array_length(fcm_tokens, 1) as fcm_count
      FROM users 
      WHERE notifiche_preferenze->>'demos' = 'true'
      ORDER BY created_at DESC
      LIMIT 20
    `);
    
    console.log(`✅ Trovati ${demosResult.rows.length} utenti con demos: true\n`);
    
    if (demosResult.rows.length === 0) {
      console.log('⚠️ Nessun utente con demos: true trovato');
      return;
    }
    
    // Mostra dettagli
    demosResult.rows.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email || user.id}`);
      console.log(`   Nome: ${user.nome || 'N/A'} ${user.cognome || 'N/A'}`);
      console.log(`   demos: ${user.demos_value}`);
      console.log(`   notifiche_preferenze: ${JSON.stringify(user.notifiche_preferenze)}`);
      console.log(`   fcm_tokens: ${user.fcm_tokens ? JSON.stringify(user.fcm_tokens) : 'NULL'}`);
      console.log(`   fcm_count: ${user.fcm_count || 0}`);
      
      if (!user.fcm_tokens || user.fcm_count === 0) {
        console.log(`   ⚠️ PROBLEMA: Utente ha demos: true ma NON ha token FCM`);
        console.log(`   💡 Questo significa che l'utente non ha ancora concesso i permessi per le notifiche push nel browser`);
      } else {
        console.log(`   ✅ OK: Utente ha demos: true E token FCM`);
      }
      console.log('');
    });
    
    // 2. Statistiche
    console.log('\n📊 STATISTICHE:\n');
    const withTokens = demosResult.rows.filter(u => u.fcm_count > 0).length;
    const withoutTokens = demosResult.rows.length - withTokens;
    
    console.log(`   Utenti con demos: true: ${demosResult.rows.length}`);
    console.log(`   ✅ Con token FCM: ${withTokens}`);
    console.log(`   ⚠️ Senza token FCM: ${withoutTokens}`);
    
    if (withoutTokens > 0) {
      console.log('\n💡 SOLUZIONE:');
      console.log('   Gli utenti devono:');
      console.log('   1. Aprire la webapp nel browser');
      console.log('   2. Concedere i permessi per le notifiche quando richiesto');
      console.log('   3. Il sistema salverà automaticamente il token FCM tramite useSyncFcmToken');
      console.log('\n   Oppure, se hanno già concesso i permessi ma il token non è stato salvato:');
      console.log('   - Verifica che useSyncFcmToken sia attivo nell\'App.tsx');
      console.log('   - Verifica che Firebase sia configurato correttamente nel frontend');
      console.log('   - Verifica che l\'endpoint /api/fcm-tokens funzioni');
    }
    
    // 3. Verifica tutti gli utenti con fcm_tokens
    console.log('\n📊 TEST 2: Tutti gli utenti con token FCM\n');
    const allFcmResult = await pool.query(`
      SELECT 
        id, 
        email,
        notifiche_preferenze->>'demos' as demos_value,
        array_length(fcm_tokens, 1) as fcm_count
      FROM users 
      WHERE fcm_tokens IS NOT NULL 
        AND array_length(fcm_tokens, 1) > 0
      LIMIT 10
    `);
    
    console.log(`✅ Trovati ${allFcmResult.rows.length} utenti con token FCM (indipendentemente da demos)`);
    allFcmResult.rows.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.email || user.id} - demos: ${user.demos_value || 'false'} - tokens: ${user.fcm_count}`);
    });
    
    // 4. Verifica utenti pronti per push (demos: true AND fcm_tokens)
    console.log('\n📊 TEST 3: Utenti PRONTI per ricevere push notifications\n');
    const readyResult = await pool.query(`
      SELECT 
        id, 
        email,
        notifiche_preferenze->>'demos' as demos_value,
        array_length(fcm_tokens, 1) as fcm_count,
        fcm_tokens
      FROM users 
      WHERE notifiche_preferenze->>'demos' = 'true'
        AND fcm_tokens IS NOT NULL 
        AND array_length(fcm_tokens, 1) > 0
      LIMIT 10
    `);
    
    if (readyResult.rows.length === 0) {
      console.log('❌ NESSUN utente pronto per ricevere push notifications');
      console.log('   Problema: Gli utenti hanno demos: true ma non hanno token FCM');
    } else {
      console.log(`✅ Trovati ${readyResult.rows.length} utenti PRONTI per push notifications:`);
      readyResult.rows.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.email || user.id}`);
        console.log(`      Token FCM: ${user.fcm_tokens[0].substring(0, 30)}...`);
      });
    }
    
  } catch (error) {
    console.error('❌ Errore:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

verificaUtentiDemos()
  .then(() => {
    console.log('\n✅ Verifica completata');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Errore:', error);
    process.exit(1);
  });

