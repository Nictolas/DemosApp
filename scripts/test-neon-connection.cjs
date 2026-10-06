const { Pool } = require('pg');
require('dotenv').config();

async function testNeonConnection() {
  console.log('🧪 Test connessione database Neon...');
  
  if (!process.env.DATABASE_URL) {
    console.error('❌ Variabile DATABASE_URL non trovata nel file .env');
    console.log('📝 Aggiungi la variabile DATABASE_URL con le credenziali del database Neon');
    process.exit(1);
  }
  
  console.log('🔗 URL database:', process.env.DATABASE_URL.replace(/:[^:@]*@/, ':***@'));
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: true
    }
  });
  
  try {
    // Test connessione
    const client = await pool.connect();
    console.log('✅ Connesso al database Neon con successo!');
    
    // Test query semplice
    const result = await client.query('SELECT version()');
    console.log('📊 Versione PostgreSQL:', result.rows[0].version);
    
    // Test creazione tabella di test
    await client.query(`
      CREATE TABLE IF NOT EXISTS test_migration (
        id SERIAL PRIMARY KEY,
        test_data TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabella di test creata/verificata');
    
    // Test inserimento
    await client.query(`
      INSERT INTO test_migration (test_data) VALUES ($1)
    `, ['Test migrazione Neon - ' + new Date().toISOString()]);
    console.log('✅ Inserimento test riuscito');
    
    // Test lettura
    const testResult = await client.query('SELECT * FROM test_migration ORDER BY created_at DESC LIMIT 1');
    console.log('📖 Dati test letti:', testResult.rows[0]);
    
    // Pulizia
    await client.query('DELETE FROM test_migration WHERE test_data LIKE $1', ['Test migrazione Neon%']);
    console.log('🧹 Dati test puliti');
    
    client.release();
    console.log('\n🎉 Test connessione completato con successo!');
    console.log('🚀 Il database Neon è pronto per la migrazione');
    
  } catch (error) {
    console.error('❌ Errore durante il test:', error.message);
    
    if (error.code === 'ENOTFOUND') {
      console.log('\n💡 Possibili soluzioni:');
      console.log('   1. Verifica che l\'URL del database sia corretto');
      console.log('   2. Controlla che il database sia stato creato su Vercel');
      console.log('   3. Verifica le credenziali di accesso');
    } else if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Possibili soluzioni:');
      console.log('   1. Verifica che il database sia attivo su Vercel');
      console.log('   2. Controlla le impostazioni di sicurezza del database');
      console.log('   3. Verifica che l\'IP sia autorizzato');
    }
    
  } finally {
    await pool.end();
    process.exit(0);
  }
}

testNeonConnection();
