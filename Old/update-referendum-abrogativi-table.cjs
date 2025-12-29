const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function updateTable() {
  try {
    console.log('🔧 Inizializzazione pool database ottimizzato...');
    console.log('🔧 Migrazione tabella referendum_abrogativi per renderla uguale alla tabella ice...');
    
    // Aggiungi colonne mancanti se non esistono già
    const alterTableQueries = [
      `ALTER TABLE referendum_abrogativi ADD COLUMN IF NOT EXISTS descrizione TEXT;`,
      `ALTER TABLE referendum_abrogativi ADD COLUMN IF NOT EXISTS datainizio DATE;`,
      `ALTER TABLE referendum_abrogativi ADD COLUMN IF NOT EXISTS datafine DATE;`,
      `ALTER TABLE referendum_abrogativi ADD COLUMN IF NOT EXISTS sitoweb TEXT;`,
      `ALTER TABLE referendum_abrogativi ADD COLUMN IF NOT EXISTS data_creazione TIMESTAMP WITH TIME ZONE DEFAULT NOW();`,
      `ALTER TABLE referendum_abrogativi ADD COLUMN IF NOT EXISTS votiices INTEGER DEFAULT 0;`,
      `ALTER TABLE referendum_abrogativi ADD COLUMN IF NOT EXISTS firme INTEGER DEFAULT 0;`,
      `ALTER TABLE referendum_abrogativi ADD COLUMN IF NOT EXISTS esito TEXT;`,
      `ALTER TABLE referendum_abrogativi DROP COLUMN IF EXISTS status;`, // Remove old status column if exists
      `ALTER TABLE referendum_abrogativi DROP COLUMN IF EXISTS userid;`, // Remove old userid column if exists
      `ALTER TABLE referendum_abrogativi DROP COLUMN IF EXISTS updated_at;` // Remove old updated_at column if exists
    ];
    
    for (const query of alterTableQueries) {
      try {
        await pool.query(query);
        console.log(`✅ Eseguito: ${query}`);
      } catch (error) {
        console.log(`⚠️ Errore nell'esecuzione della query: ${error.message}`);
      }
    }
    
    // Verifica la struttura finale
    const tableInfoQuery = `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'referendum_abrogativi'
      ORDER BY ordinal_position;
    `;
    const tableInfo = await pool.query(tableInfoQuery);
    console.log('📋 Nuova struttura della tabella referendum_abrogativi:');
    tableInfo.rows.forEach(col => console.log(`- ${col.column_name} (${col.data_type})`));
    
    console.log('✅ Migrazione della tabella referendum_abrogativi completata con successo.');
    
  } catch (error) {
    console.error('❌ Errore nell\'aggiornamento della tabella:', error);
  } finally {
    await pool.end();
  }
}

updateTable();
