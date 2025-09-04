const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function addOrganizzatoreColumn() {
  console.log('🏗️ Aggiunta colonna organizzatore alla tabella eventi...');
  
  try {
    const client = await pool.connect();
    console.log('✅ Connesso al database di produzione');
    
    // Aggiungi la colonna organizzatore
    const addColumn = `
      ALTER TABLE eventi 
      ADD COLUMN IF NOT EXISTS organizzatore VARCHAR(255);
    `;
    
    await client.query(addColumn);
    console.log('✅ Colonna organizzatore aggiunta alla tabella eventi');
    
    // Aggiorna alcuni eventi esistenti con un organizzatore di esempio
    const updateEvents = `
      UPDATE eventi 
      SET organizzatore = 'Comune di Firenze'
      WHERE nome_evento = 'Assemblea Pubblica';
      
      UPDATE eventi 
      SET organizzatore = 'Comune di Milano'
      WHERE nome_evento = 'Incontro con i Cittadini';
      
      UPDATE eventi 
      SET organizzatore = 'Regione Lazio'
      WHERE nome_evento = 'Conferenza Stampa';
      
      UPDATE eventi 
      SET organizzatore = 'Comune di Bologna'
      WHERE nome_evento = 'Consiglio Comunale';
      
      UPDATE eventi 
      SET organizzatore = 'Comune di Venezia'
      WHERE nome_evento = 'Presentazione Piano Urbanistico';
    `;
    
    await client.query(updateEvents);
    console.log('✅ Eventi aggiornati con organizzatori di esempio');
    
    // Verifica i dati
    const result = await client.query('SELECT nome_evento, organizzatore FROM eventi LIMIT 5');
    console.log('📊 Eventi con organizzatori:');
    result.rows.forEach(row => {
      console.log(`  - ${row.nome_evento}: ${row.organizzatore}`);
    });
    
    client.release();
    console.log('🎉 Operazione completata con successo!');
    
  } catch (error) {
    console.error('❌ Errore:', error);
  } finally {
    await pool.end();
  }
}

addOrganizzatoreColumn();
