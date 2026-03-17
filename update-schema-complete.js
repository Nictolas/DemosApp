#!/usr/bin/env node

/**
 * Aggiorna schema database con tutte le tabelle necessarie
 */

import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configurazione database Neon
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL mancante. Impostala come variabile d’ambiente.');
  process.exit(1);
}

async function updateSchemaComplete() {
  console.log('🔍 Aggiornamento schema database completo...');
  console.log('📅 Data operazione:', new Date().toISOString());
  
  try {
    // Leggi il nuovo schema completo
    const schemaPath = join(__dirname, 'server', 'database', 'schema-complete.sql');
    const schemaSQL = readFileSync(schemaPath, 'utf8');
    
    console.log('📄 Schema completo letto da:', schemaPath);
    
    // Applica il nuovo schema (CREATE TABLE IF NOT EXISTS non sovrascrive)
    console.log('\n🏗️ Applicazione schema completo...');
    await pool.query(schemaSQL);
    
    console.log('✅ Schema completo applicato con successo!');
    
    // Verifica che tutte le tabelle siano state create
    console.log('\n🔍 Verifica tabelle create...');
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('📊 Tabelle presenti nel database:');
    tables.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });
    
    // Verifica che gli utenti esistenti siano ancora presenti
    const userCount = await pool.query('SELECT COUNT(*) as count FROM utenti');
    console.log(`\n👥 Utenti nel database: ${userCount.rows[0].count}`);
    
    console.log('\n🎉 Schema aggiornato con successo!');
    console.log('📊 Database Neon pronto per la migrazione completa');
    
  } catch (error) {
    console.error('\n❌ Errore durante l\'aggiornamento dello schema:', error);
    process.exit(1);
  } finally {
    await pool.end();
    console.log('\n🔒 Connessione chiusa');
  }
}

// Esegui aggiornamento schema
updateSchemaComplete();
