#!/usr/bin/env node

/**
 * Script per aggiungere supporto CIE al database
 * Aggiunge colonne per auth_method e verified
 */

const { Pool } = require('pg');

// Configurazione database Neon
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://neondb_owner:npg_oifPG6Kvz0UT@ep-withered-butterfly-a2mroznt-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require',
  ssl: {
    rejectUnauthorized: false
  }
});

async function addCIESupport() {
  try {
    console.log('🔧 Aggiungendo supporto CIE al database...');
    
    // Aggiungi colonna auth_method se non esiste
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS auth_method VARCHAR(20) DEFAULT 'credentials'
    `);
    
    // Aggiungi colonna verified se non esiste
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT false
    `);
    
    // Aggiungi colonna data_nascita se non esiste (per CIE)
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS data_nascita DATE
    `);
    
    // Aggiungi colonna sesso se non esiste (per CIE)
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS sesso VARCHAR(1)
    `);
    
    // Aggiungi colonna luogo_nascita se non esiste (per CIE)
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS luogo_nascita VARCHAR(100)
    `);
    
    // Crea indice per auth_method per performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_auth_method 
      ON users(auth_method)
    `);
    
    // Crea indice per verified per performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_verified 
      ON users(verified)
    `);
    
    // Aggiorna utenti esistenti per avere auth_method = 'credentials'
    await pool.query(`
      UPDATE users 
      SET auth_method = 'credentials' 
      WHERE auth_method IS NULL
    `);
    
    console.log('✅ Supporto CIE aggiunto con successo!');
    console.log('📋 Colonne aggiunte:');
    console.log('   - auth_method (VARCHAR)');
    console.log('   - verified (BOOLEAN)');
    console.log('   - data_nascita (DATE)');
    console.log('   - sesso (VARCHAR)');
    console.log('   - luogo_nascita (VARCHAR)');
    console.log('📊 Indici creati per performance');
    
  } catch (error) {
    console.error('❌ Errore durante l\'aggiunta del supporto CIE:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Esegui lo script
addCIESupport()
  .then(() => {
    console.log('🎉 Script completato con successo!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script fallito:', error);
    process.exit(1);
  });
