#!/usr/bin/env node

/**
 * Test semplice connessione database Neon
 */

import { Pool } from 'pg';

// Configurazione database Neon
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: true
  }
});

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL mancante. Impostala come variabile d’ambiente.');
  process.exit(1);
}

async function testConnection() {
  console.log('🔍 Test connessione database Neon...');
  console.log('📅 Data test:', new Date().toISOString());
  
  try {
    // Test connessione base
    const result = await pool.query('SELECT NOW() as current_time, version() as postgres_version');
    console.log('✅ Connessione database OK!');
    console.log('🕐 Ora server:', result.rows[0].current_time);
    console.log('📊 Versione PostgreSQL:', result.rows[0].postgres_version.split(' ')[0]);
    
    console.log('\n🎉 Test connessione completato con successo!');
    console.log('📊 Database Neon pronto per l\'uso');
    
  } catch (error) {
    console.error('\n❌ Errore durante il test:', error);
    process.exit(1);
  } finally {
    await pool.end();
    console.log('\n🔒 Connessione chiusa');
  }
}

// Esegui test
testConnection();
