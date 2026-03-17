#!/usr/bin/env node

/**
 * Aggiunge le colonne mancanti alla tabella utenti
 */

import { Pool } from 'pg';

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

async function addMissingColumns() {
  console.log('🔧 Aggiunta colonne mancanti alla tabella utenti...');
  console.log('📅 Data operazione:', new Date().toISOString());
  
  try {
    // Lista delle colonne da aggiungere
    const columns = [
      'paese_candidatura VARCHAR(100)',
      'provincia_residenza VARCHAR(100)',
      'comune_residenza VARCHAR(100)',
      'regione_residenza VARCHAR(100)',
      'provincia_elezione VARCHAR(100)',
      'regione_elezione VARCHAR(100)',
      'grado_elezione VARCHAR(100)',
      'paese_elezione VARCHAR(100)',
      'provincia_candidatura VARCHAR(100)',
      'paese_residenza VARCHAR(100)',
      'comune_candidatura VARCHAR(100)',
      'cittadina_animale BOOLEAN',
      'caccia BOOLEAN',
      'eutanasia BOOLEAN',
      'case_chiuse BOOLEAN',
      'salario_minimo BOOLEAN',
      'matrimonio_gay BOOLEAN',
      'legalizzazione_canapa BOOLEAN',
      'energia_nucleare BOOLEAN',
      'nato BOOLEAN',
      'omobitransfobia BOOLEAN',
      'data_nascita DATE',
      'genere VARCHAR(20)',
      'uid VARCHAR(255)'
    ];
    
    for (const column of columns) {
      const columnName = column.split(' ')[0];
      
      try {
        await pool.query(`ALTER TABLE utenti ADD COLUMN IF NOT EXISTS ${column}`);
        console.log(`✅ Aggiunta colonna: ${columnName}`);
      } catch (error) {
        if (error.code === '42701') { // Duplicate column
          console.log(`ℹ️ Colonna già esistente: ${columnName}`);
        } else {
          console.error(`❌ Errore aggiunta colonna ${columnName}:`, error.message);
        }
      }
    }
    
    console.log('\n🎉 Colonne aggiunte con successo!');
    
  } catch (error) {
    console.error('\n❌ Errore durante l\'aggiunta delle colonne:', error);
  } finally {
    await pool.end();
    console.log('\n🔒 Connessione chiusa');
  }
}

// Esegui aggiunta colonne
addMissingColumns();
