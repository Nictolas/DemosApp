const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkICETableStructure() {
  try {
    console.log('🔍 Verifica struttura tabella ICE...');
    
    // Verifica tutte le colonne della tabella ice
    const query = `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'ice' 
      ORDER BY ordinal_position
    `;
    
    const result = await pool.query(query);
    
    console.log(`📋 Trovate ${result.rows.length} colonne nella tabella ice:`);
    result.rows.forEach((column, index) => {
      console.log(`${index + 1}. ${column.column_name}: ${column.data_type} (nullable: ${column.is_nullable})`);
    });
    
    // Conta i record
    const countQuery = 'SELECT COUNT(*) as total FROM ice';
    const countResult = await pool.query(countQuery);
    console.log(`\n📊 Record totali nella tabella ice: ${countResult.rows[0].total}`);
    
    // Mostra alcuni record
    if (parseInt(countResult.rows[0].total) > 0) {
      const sampleQuery = 'SELECT * FROM ice LIMIT 3';
      const sampleResult = await pool.query(sampleQuery);
      console.log('\n📋 Record di esempio:');
      sampleResult.rows.forEach((record, index) => {
        console.log(`  ${index + 1}. ${JSON.stringify(record, null, 2)}`);
      });
    } else {
      console.log('\n📋 Nessun record nella tabella ice');
      
      // Inserisci alcuni dati di esempio
      console.log('\n🔧 Inserimento dati di esempio...');
      const insertQuery = `
        INSERT INTO ice (utente_id, titolo, descrizione, tipo, stato)
        VALUES 
          ('b4c3532a-5f3b-4cca-99ab-77e0e1029857', 'Richiesta ICE Esempio 1', 'Descrizione della prima richiesta ICE', 'tipo1', 'approvata'),
          ('b4c3532a-5f3b-4cca-99ab-77e0e1029857', 'Richiesta ICE Esempio 2', 'Descrizione della seconda richiesta ICE', 'tipo2', 'in_attesa')
        ON CONFLICT DO NOTHING
      `;
      
      await pool.query(insertQuery);
      console.log('✅ Dati di esempio inseriti');
    }
    
  } catch (error) {
    console.error('❌ Errore:', error);
  } finally {
    await pool.end();
  }
}

checkICETableStructure();
