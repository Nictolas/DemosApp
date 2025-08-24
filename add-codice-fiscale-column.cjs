const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function addCodiceFiscaleColumn() {
  try {
    console.log('🔧 Aggiunta colonna codice_fiscale alla tabella users...');
    
    const client = await pool.connect();
    
    // Verifica se la colonna esiste già
    const columnExists = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'codice_fiscale'
      );
    `);
    
    if (columnExists.rows[0].exists) {
      console.log('✅ La colonna codice_fiscale esiste già');
      return;
    }
    
    // Aggiungi la colonna codice_fiscale
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN codice_fiscale VARCHAR(16) UNIQUE
    `);
    
    console.log('✅ Colonna codice_fiscale aggiunta con successo');
    
    // Aggiungi un indice per migliorare le performance delle ricerche
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_codice_fiscale 
      ON users(codice_fiscale)
    `);
    
    console.log('✅ Indice su codice_fiscale creato');
    
    client.release();
    
  } catch (error) {
    console.error('❌ Errore nell\'aggiunta della colonna:', error);
  } finally {
    await pool.end();
  }
}

addCodiceFiscaleColumn();
