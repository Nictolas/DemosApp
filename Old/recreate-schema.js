#!/usr/bin/env node

/**
 * Ricrea schema PostgreSQL compatibile con Firebase
 */

import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configurazione database Neon
const pool = new Pool({
  connectionString: 'postgres://neondb_owner:[REDACTED_NEON_PASSWORD]@ep-withered-butterfly-a2mroznt-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require',
  ssl: {
    rejectUnauthorized: false
  }
});

async function recreateSchema() {
  console.log('🔍 Ricreazione schema database Neon...');
  console.log('📅 Data operazione:', new Date().toISOString());
  
  try {
    // Elimina le tabelle esistenti (in ordine per evitare errori di foreign key)
    console.log('\n🗑️ Eliminazione tabelle esistenti...');
    
    const dropQueries = [
      'DROP TABLE IF EXISTS voti_referendum_abrogativi CASCADE',
      'DROP TABLE IF EXISTS voti_capo_stato CASCADE',
      'DROP TABLE IF EXISTS premium_requests CASCADE',
      'DROP TABLE IF EXISTS comunicazioni CASCADE',
      'DROP TABLE IF EXISTS opinioni_proposte CASCADE',
      'DROP TABLE IF EXISTS opinioni CASCADE',
      'DROP TABLE IF EXISTS admin_notifications CASCADE',
      'DROP TABLE IF EXISTS utenti CASCADE'
    ];
    
    for (const query of dropQueries) {
      await pool.query(query);
      console.log(`✅ ${query}`);
    }
    
    // Leggi il nuovo schema
    const schemaPath = join(__dirname, 'server', 'database', 'schema-firebase.sql');
    const schemaSQL = readFileSync(schemaPath, 'utf8');
    
    console.log('\n📄 Nuovo schema letto da:', schemaPath);
    
    // Applica il nuovo schema
    console.log('\n🏗️ Applicazione nuovo schema...');
    await pool.query(schemaSQL);
    
    console.log('✅ Nuovo schema applicato con successo!');
    
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
    
    console.log('\n🎉 Schema ricreato con successo!');
    console.log('📊 Database Neon pronto per la migrazione Firebase');
    
  } catch (error) {
    console.error('\n❌ Errore durante la ricreazione dello schema:', error);
    process.exit(1);
  } finally {
    await pool.end();
    console.log('\n🔒 Connessione chiusa');
  }
}

// Esegui ricreazione schema
recreateSchema();
