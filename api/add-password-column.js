const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function addPasswordHashColumn() {
  try {
    console.log('🔧 Aggiunta colonna password_hash alla tabella users...');
    
    // Aggiungi la colonna password_hash se non esiste
    const addColumnQuery = `
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
    `;
    
    await pool.query(addColumnQuery);
    console.log('✅ Colonna password_hash aggiunta con successo!');
    
    // Verifica che la colonna esista
    const checkQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'password_hash';
    `;
    
    const result = await pool.query(checkQuery);
    if (result.rows.length > 0) {
      console.log('✅ Colonna password_hash verificata nel database');
    } else {
      console.log('❌ Errore: colonna password_hash non trovata');
    }
    
  } catch (error) {
    console.error('❌ Errore aggiunta colonna:', error);
  } finally {
    await pool.end();
  }
}

// Esegui se chiamato direttamente
if (require.main === module) {
  addPasswordHashColumn();
}

module.exports = { addPasswordHashColumn };
