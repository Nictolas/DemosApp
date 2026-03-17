const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function removeRedundantColumns() {
  try {
    console.log('🗑️  Rimozione colonne ridondanti...');
    
    // Tabella iniziative_popolari
    console.log('📋 Elaborazione tabella iniziative_popolari...');
    await pool.query(`
      ALTER TABLE iniziative_popolari 
      DROP COLUMN IF EXISTS firestoreid,
      DROP COLUMN IF EXISTS firestore_uid_backup,
      DROP COLUMN IF EXISTS datainizio,
      DROP COLUMN IF EXISTS datafine,
      DROP COLUMN IF EXISTS data_creazione
    `);
    console.log('✅ Colonne eliminate da iniziative_popolari');
    
    // Tabella referendum_abrogativi
    console.log('📋 Elaborazione tabella referendum_abrogativi...');
    await pool.query(`
      ALTER TABLE referendum_abrogativi 
      DROP COLUMN IF EXISTS firestoreid,
      DROP COLUMN IF EXISTS firestore_uid_backup,
      DROP COLUMN IF EXISTS datainizio,
      DROP COLUMN IF EXISTS datafine,
      DROP COLUMN IF EXISTS data_creazione
    `);
    console.log('✅ Colonne eliminate da referendum_abrogativi');
    
    // Verifica struttura finale
    console.log('\n📊 Struttura finale delle tabelle:');
    const iniziativeColumns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'iniziative_popolari'
      ORDER BY ordinal_position
    `);
    console.log('\n🔹 iniziative_popolari:');
    iniziativeColumns.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });
    
    const referendumColumns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'referendum_abrogativi'
      ORDER BY ordinal_position
    `);
    console.log('\n🔹 referendum_abrogativi:');
    referendumColumns.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });
    
    console.log('\n✅ Migrazione completata con successo!');
    
  } catch (error) {
    console.error('❌ Errore durante la migrazione:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

removeRedundantColumns();

