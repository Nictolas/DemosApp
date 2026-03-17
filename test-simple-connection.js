const { Pool } = require('pg');

// Configurazione Neon Database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:YOUR_PASSWORD@ep-misty-cherry-02001685.eu-west-1.aws.neon.tech/neondb?sslmode=require'
});

async function testConnection() {
  try {
    console.log('🔍 Test connessione database...');
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
    
    const result = await pool.query('SELECT NOW() as current_time');
    console.log('✅ Connessione riuscita! Ora:', result.rows[0].current_time);
    
    // Test tabella users
    const usersCount = await pool.query('SELECT COUNT(*) as count FROM users');
    console.log('📊 Utenti nel database:', usersCount.rows[0].count);
    
    await pool.end();
  } catch (error) {
    console.error('❌ Errore connessione:', error.message);
    await pool.end();
  }
}

testConnection();
