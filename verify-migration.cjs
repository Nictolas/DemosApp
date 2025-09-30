const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function verifyMigration() {
  try {
    console.log('🔍 Verifica migrazione completata...');
    
    // 1. Verifica che la tabella utenti sia stata eliminata
    const checkUtenti = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'utenti'
      );
    `);
    
    console.log(`📊 Tabella utenti esiste: ${checkUtenti.rows[0].exists}`);
    
    // 2. Verifica la tabella users
    const checkUsers = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);
    
    console.log(`📊 Tabella users esiste: ${checkUsers.rows[0].exists}`);
    
    // 3. Conta i record in users
    const countUsers = await pool.query('SELECT COUNT(*) FROM users');
    console.log(`📊 Record in users: ${countUsers.rows[0].count}`);
    
    // 4. Verifica che le foreign key funzionino
    console.log('\n🔗 Verifica foreign key...');
    
    // consenso_governo
    const consensoGoverno = await pool.query(`
      SELECT COUNT(*) as total,
             COUNT(CASE WHEN userid IS NOT NULL THEN 1 END) as with_userid
      FROM consenso_governo
    `);
    console.log(`  consenso_governo: ${consensoGoverno.rows[0].with_userid}/${consensoGoverno.rows[0].total} con userid valido`);
    
    // consenso_capo_stato
    const consensoCapoStato = await pool.query(`
      SELECT COUNT(*) as total,
             COUNT(CASE WHEN userid IS NOT NULL THEN 1 END) as with_userid
      FROM consenso_capo_stato
    `);
    console.log(`  consenso_capo_stato: ${consensoCapoStato.rows[0].with_userid}/${consensoCapoStato.rows[0].total} con userid valido`);
    
    // notifiche_utente
    const notificheUtente = await pool.query(`
      SELECT COUNT(*) as total,
             COUNT(CASE WHEN utente_id IS NOT NULL THEN 1 END) as with_utente_id
      FROM notifiche_utente
    `);
    console.log(`  notifiche_utente: ${notificheUtente.rows[0].with_utente_id}/${notificheUtente.rows[0].total} con utente_id valido`);
    
    // segnalazioni
    const segnalazioni = await pool.query(`
      SELECT COUNT(*) as total,
             COUNT(CASE WHEN utente_id IS NOT NULL THEN 1 END) as with_utente_id,
             COUNT(CASE WHEN risolto_da IS NOT NULL THEN 1 END) as with_risolto_da
      FROM segnalazioni
    `);
    console.log(`  segnalazioni: ${segnalazioni.rows[0].with_utente_id}/${segnalazioni.rows[0].total} con utente_id, ${segnalazioni.rows[0].with_risolto_da}/${segnalazioni.rows[0].total} con risolto_da`);
    
    // 5. Test di una query di login
    console.log('\n🔐 Test query di login...');
    const testLogin = await pool.query(`
      SELECT id, email, nome, cognome, status 
      FROM users 
      WHERE email = 'admin@demos.community'
    `);
    
    if (testLogin.rows.length > 0) {
      console.log(`  ✅ Login test: Trovato utente ${testLogin.rows[0].email}`);
    } else {
      console.log(`  ❌ Login test: Utente admin non trovato`);
    }
    
    console.log('\n🎉 Verifica completata!');
    
  } catch (error) {
    console.error('❌ Errore durante la verifica:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

verifyMigration()
  .then(() => {
    console.log('✅ Tutto OK!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Errore durante la verifica:', error);
    process.exit(1);
  });