#!/usr/bin/env node

/**
 * VERIFICA E AGGIUNGE COLONNE PER RESET PASSWORD
 * Controlla se le colonne reset_token e reset_token_expires esistono nella tabella users
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkResetPasswordColumns() {
  try {
    console.log('🔍 Verifica colonne reset password...');
    
    // 1. Verifica struttura attuale della tabella users
    const structureQuery = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position
    `;
    
    const structureResult = await pool.query(structureQuery);
    console.log('\n📋 Struttura attuale tabella users:');
    structureResult.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });
    
    // 2. Verifica se le colonne reset password esistono
    const checkQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name IN ('reset_token', 'reset_token_expires')
    `;
    
    const checkResult = await pool.query(checkQuery);
    const existingColumns = checkResult.rows.map(row => row.column_name);
    
    console.log('\n🔍 Colonne reset password esistenti:', existingColumns);
    
    // 3. Aggiungi colonne mancanti
    if (!existingColumns.includes('reset_token')) {
      console.log('\n➕ Aggiunta colonna reset_token...');
      await pool.query(`
        ALTER TABLE users 
        ADD COLUMN reset_token TEXT
      `);
      console.log('✅ Colonna reset_token aggiunta');
    } else {
      console.log('ℹ️ Colonna reset_token già esistente');
    }
    
    if (!existingColumns.includes('reset_token_expires')) {
      console.log('\n➕ Aggiunta colonna reset_token_expires...');
      await pool.query(`
        ALTER TABLE users 
        ADD COLUMN reset_token_expires TIMESTAMP
      `);
      console.log('✅ Colonna reset_token_expires aggiunta');
    } else {
      console.log('ℹ️ Colonna reset_token_expires già esistente');
    }
    
    // 4. Verifica finale
    const finalCheck = await pool.query(checkQuery);
    console.log('\n📋 Colonne reset password finali:', finalCheck.rows.map(row => row.column_name));
    
    // 5. Verifica che le colonne siano accessibili
    const testQuery = `
      SELECT reset_token, reset_token_expires 
      FROM users 
      LIMIT 1
    `;
    
    try {
      await pool.query(testQuery);
      console.log('✅ Colonne reset password accessibili e funzionanti!');
    } catch (error) {
      console.log('❌ Errore nell\'accesso alle colonne:', error.message);
    }
    
    console.log('\n✅ Setup colonne reset password completato!');
    
  } catch (error) {
    console.error('❌ Errore:', error);
  } finally {
    await pool.end();
  }
}

checkResetPasswordColumns();
