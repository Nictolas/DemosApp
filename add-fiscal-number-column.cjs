#!/usr/bin/env node

/**
 * Script per aggiungere colonna fiscal_number alla tabella users
 * Necessaria per l'autenticazione CIE
 */

const { Pool } = require('pg');

// Configurazione database Neon
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function addFiscalNumberColumn() {
  try {
    console.log('🔧 Aggiungendo colonna fiscal_number alla tabella users...');
    
    // Verifica se la colonna esiste già
    const checkColumn = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'fiscal_number'
    `);

    if (checkColumn.rows.length > 0) {
      console.log('✅ Colonna fiscal_number già esistente');
      return;
    }

    // Aggiungi colonna fiscal_number
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN fiscal_number VARCHAR(20) UNIQUE
    `);
    
    // Crea indice per performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_fiscal_number 
      ON users(fiscal_number)
    `);
    
    console.log('✅ Colonna fiscal_number aggiunta con successo!');
    console.log('📊 Indice creato per performance');
    
  } catch (error) {
    console.error('❌ Errore durante l\'aggiunta della colonna fiscal_number:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Esegui lo script
addFiscalNumberColumn()
  .then(() => {
    console.log('🎉 Script completato con successo!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script fallito:', error);
    process.exit(1);
  });

