const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function checkUsersTable() {
  try {
    console.log('🔍 Verificando struttura tabella users...');
    
    // Verifica se la tabella users esiste
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);
    
    if (!tableExists.rows[0].exists) {
      console.log('❌ La tabella "users" non esiste!');
      return;
    }
    
    console.log('✅ La tabella "users" esiste');
    
    // Verifica la struttura della tabella users
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Struttura tabella users:');
    result.rows.forEach(row => {
      console.log(`   - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });
    
    // Controlla se ci sono utenti esistenti
    const userCount = await pool.query('SELECT COUNT(*) FROM users');
    console.log(`👥 Numero totale utenti: ${userCount.rows[0].count}`);
    
    // Mostra alcuni esempi di utenti (se esistono)
    if (parseInt(userCount.rows[0].count) > 0) {
      const sampleUsers = await pool.query('SELECT id, email, nome, cognome, ruolo FROM users LIMIT 5');
      console.log('📋 Esempi utenti:');
      sampleUsers.rows.forEach(user => {
        console.log(`   - ${user.email} (${user.nome} ${user.cognome}) - Ruolo: ${user.ruolo || 'Non definito'}`);
      });
    } else {
      console.log('📋 Nessun utente presente nella tabella');
    }
    
  } catch (error) {
    console.error('❌ Errore durante la verifica:', error);
  } finally {
    await pool.end();
  }
}

checkUsersTable();
