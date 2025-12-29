const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function addResetPasswordColumns() {
  try {
    console.log('🔧 Aggiunta colonne per reset password...');
    
    // Verifica se le colonne esistono già
    const checkQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name IN ('reset_token', 'reset_token_expires')
    `;
    
    const checkResult = await pool.query(checkQuery);
    const existingColumns = checkResult.rows.map(row => row.column_name);
    
    console.log('📋 Colonne esistenti:', existingColumns);
    
    // Aggiungi reset_token se non esiste
    if (!existingColumns.includes('reset_token')) {
      console.log('➕ Aggiunta colonna reset_token...');
      await pool.query(`
        ALTER TABLE users 
        ADD COLUMN reset_token TEXT
      `);
      console.log('✅ Colonna reset_token aggiunta');
    } else {
      console.log('ℹ️ Colonna reset_token già esistente');
    }
    
    // Aggiungi reset_token_expires se non esiste
    if (!existingColumns.includes('reset_token_expires')) {
      console.log('➕ Aggiunta colonna reset_token_expires...');
      await pool.query(`
        ALTER TABLE users 
        ADD COLUMN reset_token_expires TIMESTAMP
      `);
      console.log('✅ Colonna reset_token_expires aggiunta');
    } else {
      console.log('ℹ️ Colonna reset_token_expires già esistente');
    }
    
    // Verifica finale
    const finalCheck = await pool.query(checkQuery);
    console.log('📋 Colonne finali:', finalCheck.rows.map(row => row.column_name));
    
    console.log('✅ Setup colonne reset password completato!');
    
  } catch (error) {
    console.error('❌ Errore:', error);
  } finally {
    await pool.end();
  }
}

addResetPasswordColumns();
