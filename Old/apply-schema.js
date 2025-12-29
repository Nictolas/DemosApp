#!/usr/bin/env node

/**
 * Applica schema PostgreSQL al database Neon
 */

import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configurazione database Neon
const pool = new Pool({
  connectionString: 'postgres://neondb_owner:npg_oifPG6Kvz0UT@ep-withered-butterfly-a2mroznt-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require',
  ssl: {
    rejectUnauthorized: false
  }
});

async function applySchema() {
  console.log('🔍 Applicazione schema database Neon...');
  console.log('📅 Data operazione:', new Date().toISOString());
  
  try {
    // Leggi il file schema.sql
    const schemaPath = join(__dirname, 'server', 'database', 'schema.sql');
    const schemaSQL = readFileSync(schemaPath, 'utf8');
    
    console.log('📄 Schema letto da:', schemaPath);
    
    // Applica lo schema
    console.log('\n🏗️ Applicazione schema...');
    await pool.query(schemaSQL);
    
    console.log('✅ Schema applicato con successo!');
    
    // Verifica che le tabelle siano state create
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
    
    console.log('\n🎉 Schema applicato e verificato con successo!');
    console.log('📊 Database Neon pronto per l\'uso');
    
  } catch (error) {
    console.error('\n❌ Errore durante l\'applicazione dello schema:', error);
    process.exit(1);
  } finally {
    await pool.end();
    console.log('\n🔒 Connessione chiusa');
  }
}

// Esegui applicazione schema
applySchema();
