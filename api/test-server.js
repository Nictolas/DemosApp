const { Pool } = require('pg');
require('dotenv').config();

console.log('🔧 Test connessione database Neon...');

// Configurazione database Neon
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function testConnection() {
  try {
    console.log('📡 Tentativo di connessione...');
    const result = await pool.query('SELECT NOW() as current_time, version() as postgres_version');
    console.log('✅ Connessione riuscita!');
    console.log('🕐 Ora corrente:', result.rows[0].current_time);
    console.log('📊 Versione PostgreSQL:', result.rows[0].postgres_version);
    
    // Test conteggio utenti
    const userCount = await pool.query('SELECT COUNT(*) as count FROM utenti');
    console.log('👥 Numero utenti:', userCount.rows[0].count);
    
    // Test conteggio opinioni
    const opinionCount = await pool.query('SELECT COUNT(*) as count FROM opinioni');
    console.log('💭 Numero opinioni:', opinionCount.rows[0].count);
    
    await pool.end();
    console.log('✅ Test completato con successo!');
  } catch (error) {
    console.error('❌ Errore connessione:', error.message);
    process.exit(1);
  }
}

testConnection();
