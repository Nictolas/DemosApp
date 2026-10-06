const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false
});

async function checkData() {
  try {
    const result = await pool.query(`
      SELECT 
        votazione_id, 
        descrizione, 
        esito, 
        metadati,
        data_sincronizzazione
      FROM voti_politici 
      ORDER BY id DESC 
      LIMIT 10
    `);
    
    console.log(`📊 Record nella tabella: ${result.rows.length}\n`);
    console.log('Ultime votazioni salvate:');
    console.log('='.repeat(80));
    
    result.rows.forEach((row, i) => {
      console.log(`\n${i+1}. ID: ${row.votazione_id}`);
      console.log(`   Descrizione: ${row.descrizione || 'N/A'}`);
      console.log(`   Esito: ${row.esito || 'N/A'}`);
      const seduta = row.metadati?.seduta || (typeof row.metadati === 'object' ? row.metadati.seduta : null);
      console.log(`   Seduta: ${seduta ? (typeof seduta === 'string' ? seduta.split('/').pop() : seduta) : 'N/A'}`);
      console.log(`   Sincronizzato: ${row.data_sincronizzazione ? new Date(row.data_sincronizzazione).toLocaleString('it-IT') : 'N/A'}`);
      
      // Verifica se è della XIX legislatura (vs19 nel nome)
      if (row.votazione_id && row.votazione_id.includes('vs19')) {
        console.log(`   ✅ Probabilmente XIX legislatura (vs19 nel nome)`);
      }
    });
    
  } catch (error) {
    console.error('❌ Errore:', error.message);
  } finally {
    await pool.end();
  }
}

checkData();

