const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function createComunicazioniTable() {
  try {
    console.log('🔧 Creazione tabella comunicazioni...');
    
    // Prima elimino la tabella se esiste per ricrearla correttamente
    await pool.query('DROP TABLE IF EXISTS comunicazioni CASCADE');
    console.log('🗑️ Tabella comunicazioni esistente eliminata');
    
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS comunicazioni (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        titolo VARCHAR(255) NOT NULL,
        voto_dato VARCHAR(50) NOT NULL CHECK (voto_dato IN ('Favorevole', 'Contrario', 'Astenuto')),
        commento TEXT,
        vincitore VARCHAR(50) NOT NULL CHECK (vincitore IN ('Favorevole', 'Contrario', 'Astenuto')),
        zona VARCHAR(255) NOT NULL,
        utente_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        likes INTEGER DEFAULT 0,
        dislikes INTEGER DEFAULT 0,
        data_creazione TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        data_aggiornamento TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    
    await pool.query(createTableQuery);
    console.log('✅ Tabella comunicazioni creata con successo!');
    
    // Aggiungi indici per migliorare le performance
    const createIndexesQuery = `
      CREATE INDEX IF NOT EXISTS idx_comunicazioni_utente ON comunicazioni(utente_id);
      CREATE INDEX IF NOT EXISTS idx_comunicazioni_zona ON comunicazioni(zona);
      CREATE INDEX IF NOT EXISTS idx_comunicazioni_data ON comunicazioni(data_creazione);
      CREATE INDEX IF NOT EXISTS idx_comunicazioni_voto ON comunicazioni(voto_dato);
      CREATE INDEX IF NOT EXISTS idx_comunicazioni_vincitore ON comunicazioni(vincitore);
    `;
    
    await pool.query(createIndexesQuery);
    console.log('✅ Indici creati con successo!');
    
    // Verifica la struttura della tabella
    const verifyQuery = `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'comunicazioni' 
      ORDER BY ordinal_position;
    `;
    
    const result = await pool.query(verifyQuery);
    console.log('📋 Struttura tabella comunicazioni:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} ${row.is_nullable === 'YES' ? '(nullable)' : '(NOT NULL)'} ${row.column_default ? `[default: ${row.column_default}]` : ''}`);
    });
    
  } catch (error) {
    console.error('❌ Errore durante la creazione della tabella comunicazioni:', error);
  } finally {
    await pool.end();
  }
}

createComunicazioniTable();
