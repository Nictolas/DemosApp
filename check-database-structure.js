#!/usr/bin/env node

/**
 * VERIFICA STRUTTURA DATABASE NEON
 * Controlla le tabelle esistenti e le loro colonne
 */

import pkg from 'pg';
const { Pool } = pkg;

// Configurazione database Neon
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_oifPG6Kvz0UT@ep-withered-butterfly-a2mroznt-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function checkDatabaseStructure() {
  try {
    console.log('🔍 VERIFICA STRUTTURA DATABASE NEON');
    console.log('====================================');
    
    // Lista delle tabelle da controllare
    const tables = [
      'opinioni',
      'opinioni_proposte', 
      'voti_capo_stato',
      'voti_referendum_abrogativi',
      'admin_notifications',
      'elezioni',
      'iniziative_popolari',
      'voti_iniziative_popolari',
      'ice',
      'users',
      'utenti'
    ];
    
    for (const tableName of tables) {
      try {
        // Controlla se la tabella esiste
        const tableExists = await pool.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
          );
        `, [tableName]);
        
        if (tableExists.rows[0].exists) {
          console.log(`\n✅ Tabella ${tableName} ESISTE`);
          
          // Ottieni struttura colonne
          const columns = await pool.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = $1
            ORDER BY ordinal_position;
          `, [tableName]);
          
          console.log(`   📋 Colonne (${columns.rows.length}):`);
          columns.rows.forEach(col => {
            const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
            const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
            console.log(`      - ${col.column_name}: ${col.data_type} ${nullable}${defaultVal}`);
          });
          
          // Conta righe
          const count = await pool.query(`SELECT COUNT(*) FROM ${tableName}`);
          console.log(`   📊 Righe: ${count.rows[0].count}`);
          
        } else {
          console.log(`\n❌ Tabella ${tableName} NON ESISTE`);
        }
        
      } catch (error) {
        console.log(`\n⚠️ Errore controllo tabella ${tableName}: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Errore generale:', error);
  } finally {
    await pool.end();
    console.log('\n🔚 Connessione database chiusa');
  }
}

checkDatabaseStructure();
