const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function createEventiTable() {
  try {
    console.log('🔧 Creazione tabella eventi...');
    
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS eventi (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        nome_evento VARCHAR(255) NOT NULL,
        tipologia_evento VARCHAR(100) NOT NULL,
        paese_evento VARCHAR(100),
        regione_evento VARCHAR(100),
        provincia_evento VARCHAR(100),
        comune_evento VARCHAR(100),
        indirizzo_evento TEXT,
        orario_evento TIME,
        inizio_evento TIMESTAMP,
        fine_evento TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    
    await pool.query(createTableQuery);
    console.log('✅ Tabella eventi creata con successo!');
    
    // Aggiungi indici per migliorare le performance
    const createIndexesQuery = `
      CREATE INDEX IF NOT EXISTS idx_eventi_tipologia ON eventi(tipologia_evento);
      CREATE INDEX IF NOT EXISTS idx_eventi_inizio ON eventi(inizio_evento);
      CREATE INDEX IF NOT EXISTS idx_eventi_fine ON eventi(fine_evento);
      CREATE INDEX IF NOT EXISTS idx_eventi_regione ON eventi(regione_evento);
      CREATE INDEX IF NOT EXISTS idx_eventi_provincia ON eventi(provincia_evento);
      CREATE INDEX IF NOT EXISTS idx_eventi_comune ON eventi(comune_evento);
    `;
    
    await pool.query(createIndexesQuery);
    console.log('✅ Indici creati con successo!');
    
    // Verifica la struttura della tabella
    const verifyQuery = `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'eventi' 
      ORDER BY ordinal_position;
    `;
    
    const result = await pool.query(verifyQuery);
    console.log('📋 Struttura tabella eventi:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} ${row.is_nullable === 'YES' ? '(nullable)' : '(NOT NULL)'} ${row.column_default ? `[default: ${row.column_default}]` : ''}`);
    });
    
  } catch (error) {
    console.error('❌ Errore durante la creazione della tabella eventi:', error);
  } finally {
    await pool.end();
  }
}

createEventiTable();
