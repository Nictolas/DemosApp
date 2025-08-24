const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function addEmailVerificationColumn() {
  try {
    console.log('🔍 Verificando se la colonna email_verification_token esiste...');
    
    // Verifica se la colonna esiste già
    const checkColumnQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'email_verification_token'
    `;
    
    const checkResult = await pool.query(checkColumnQuery);
    
    if (checkResult.rows.length > 0) {
      console.log('✅ La colonna email_verification_token esiste già');
      return;
    }
    
    console.log('📝 Aggiungendo la colonna email_verification_token...');
    
    // Aggiungi la colonna
    const addColumnQuery = `
      ALTER TABLE users 
      ADD COLUMN email_verification_token TEXT
    `;
    
    await pool.query(addColumnQuery);
    
    console.log('✅ Colonna email_verification_token aggiunta con successo');
    
    // Verifica che la colonna sia stata aggiunta
    const verifyResult = await pool.query(checkColumnQuery);
    
    if (verifyResult.rows.length > 0) {
      console.log('✅ Verifica: colonna email_verification_token presente nella tabella users');
    } else {
      console.log('❌ Errore: colonna non trovata dopo l\'aggiunta');
    }
    
  } catch (error) {
    console.error('❌ Errore nell\'aggiunta della colonna:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Esegui lo script
addEmailVerificationColumn()
  .then(() => {
    console.log('🎉 Script completato con successo');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script fallito:', error);
    process.exit(1);
  });
