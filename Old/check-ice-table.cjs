const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkICETable() {
  try {
    console.log('🔍 Verifica tabella ICE nel database...');
    
    // Verifica se la tabella ICE esiste
    const tableQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'ice' OR table_name = 'richieste_ice'
    `;
    
    const tableResult = await pool.query(tableQuery);
    
    if (tableResult.rows.length === 0) {
      console.log('❌ Tabella ICE non trovata');
      console.log('🔧 Creazione tabella ICE...');
      
      // Crea la tabella ICE
      const createTableQuery = `
        CREATE TABLE IF NOT EXISTS richieste_ice (
          id SERIAL PRIMARY KEY,
          utente_id UUID REFERENCES users(id),
          titolo TEXT NOT NULL,
          descrizione TEXT,
          tipo VARCHAR(50),
          stato VARCHAR(20) DEFAULT 'in_attesa',
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `;
      
      await pool.query(createTableQuery);
      console.log('✅ Tabella richieste_ice creata');
      
      // Inserisci alcuni dati di esempio
      console.log('🔧 Inserimento dati di esempio...');
      const insertQuery = `
        INSERT INTO richieste_ice (utente_id, titolo, descrizione, tipo, stato)
        VALUES 
          ('b4c3532a-5f3b-4cca-99ab-77e0e1029857', 'Richiesta ICE Esempio 1', 'Descrizione della prima richiesta ICE', 'tipo1', 'approvata'),
          ('b4c3532a-5f3b-4cca-99ab-77e0e1029857', 'Richiesta ICE Esempio 2', 'Descrizione della seconda richiesta ICE', 'tipo2', 'in_attesa')
        ON CONFLICT DO NOTHING
      `;
      
      await pool.query(insertQuery);
      console.log('✅ Dati di esempio inseriti');
      
    } else {
      console.log('✅ Tabella ICE trovata:', tableResult.rows.map(r => r.table_name));
      
      // Verifica la struttura della tabella
      const structureQuery = `
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'richieste_ice'
        ORDER BY ordinal_position
      `;
      
      const structureResult = await pool.query(structureQuery);
      console.log('📋 Struttura tabella:');
      structureResult.rows.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
      });
      
      // Conta i record
      const countQuery = 'SELECT COUNT(*) as total FROM richieste_ice';
      const countResult = await pool.query(countQuery);
      console.log(`📊 Record totali: ${countResult.rows[0].total}`);
      
      // Mostra alcuni record
      const sampleQuery = 'SELECT * FROM richieste_ice LIMIT 3';
      const sampleResult = await pool.query(sampleQuery);
      console.log('📋 Record di esempio:');
      sampleResult.rows.forEach((record, index) => {
        console.log(`  ${index + 1}. ID: ${record.id}, Titolo: ${record.titolo}, Stato: ${record.stato}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Errore:', error);
  } finally {
    await pool.end();
  }
}

checkICETable();
