#!/usr/bin/env node

/**
 * Test connessione database Neon
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';

// Carica variabili d'ambiente
dotenv.config();

// Configurazione database Neon
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL || 'postgres://neondb_owner:[REDACTED_NEON_PASSWORD]@ep-withered-butterfly-a2mroznt-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require',
  ssl: {
    rejectUnauthorized: false
  }
});

async function testConnection() {
  console.log('🔍 Test connessione database Neon...');
  console.log('📅 Data test:', new Date().toISOString());
  
  try {
    // Test connessione base
    const result = await pool.query('SELECT NOW() as current_time, version() as postgres_version');
    console.log('✅ Connessione database OK!');
    console.log('🕐 Ora server:', result.rows[0].current_time);
    console.log('📊 Versione PostgreSQL:', result.rows[0].postgres_version.split(' ')[0]);
    
    // Test creazione tabella di prova
    console.log('\n🧪 Test creazione tabella...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS test_connection (
        id SERIAL PRIMARY KEY,
        message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabella test creata/verificata');
    
    // Test inserimento dati
    await pool.query(`
      INSERT INTO test_connection (message) 
      VALUES ($1) 
      ON CONFLICT DO NOTHING
    `, ['Test connessione Neon completato']);
    console.log('✅ Inserimento dati OK');
    
    // Test lettura dati
    const testData = await pool.query('SELECT * FROM test_connection ORDER BY created_at DESC LIMIT 1');
    console.log('✅ Lettura dati OK:', testData.rows[0]);
    
    // Pulizia tabella test
    await pool.query('DROP TABLE IF EXISTS test_connection');
    console.log('✅ Pulizia tabella test completata');
    
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

// Esegui test se chiamato direttamente
if (import.meta.url === `file://${process.argv[1]}`) {
  testConnection();
}

export { testConnection };
