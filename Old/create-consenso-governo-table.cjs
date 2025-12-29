const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function createConsensoGovernoTable() {
  try {
    console.log('🔍 Creazione tabella consenso_governo...');
    
    // Crea la tabella consenso_governo
    await pool.query(`
      CREATE TABLE IF NOT EXISTS consenso_governo (
        id VARCHAR(255) PRIMARY KEY,
        userid VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        risposta VARCHAR(10) NOT NULL CHECK (risposta IN ('Sì', 'Non so', 'No')),
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Crea indice per migliorare le performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_consenso_governo_userid 
      ON consenso_governo(userid)
    `);
    
    // Crea indice per le query di aggregazione
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_consenso_governo_risposta 
      ON consenso_governo(risposta)
    `);
    
    console.log('✅ Tabella consenso_governo creata con successo');
    
    // Verifica che la tabella sia stata creata
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'consenso_governo'
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Struttura tabella:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (${row.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });
    
  } catch (error) {
    console.error('❌ Errore nella creazione della tabella:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

createConsensoGovernoTable()
  .then(() => {
    console.log('🎉 Script completato con successo');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Errore durante l\'esecuzione:', error);
    process.exit(1);
  });
