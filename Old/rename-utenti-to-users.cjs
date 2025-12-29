const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function renameUtentiToUsers() {
  try {
    console.log('🔍 Rinomina tabella utenti in users...');
    
    // Controlla se la tabella utenti esiste
    const checkUtenti = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'utenti'
      );
    `);
    
    if (!checkUtenti.rows[0].exists) {
      console.log('⚠️ Tabella utenti non trovata, niente da rinominare');
      return;
    }
    
    // Controlla se la tabella users esiste già
    const checkUsers = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);
    
    if (checkUsers.rows[0].exists) {
      console.log('⚠️ Tabella users esiste già, non posso rinominare');
      return;
    }
    
    // Rinomina la tabella
    await pool.query('ALTER TABLE utenti RENAME TO users;');
    console.log('✅ Tabella rinominata da utenti a users');
    
    // Rinomina l'indice
    try {
      await pool.query('ALTER INDEX idx_utenti_email RENAME TO idx_users_email;');
      console.log('✅ Indice rinominato da idx_utenti_email a idx_users_email');
    } catch (error) {
      console.log('⚠️ Indice idx_utenti_email non trovato o già rinominato');
    }
    
    // Verifica che la rinomina sia avvenuta correttamente
    const verifyUsers = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Struttura tabella users:');
    verifyUsers.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (${row.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });
    
  } catch (error) {
    console.error('❌ Errore nella rinomina della tabella:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

renameUtentiToUsers()
  .then(() => {
    console.log('🎉 Script completato con successo');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Errore durante l\'esecuzione:', error);
    process.exit(1);
  });
