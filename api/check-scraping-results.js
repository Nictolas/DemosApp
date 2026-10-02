require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false
});

async function checkResults() {
  try {
    // Conta quanti politici hanno votazioni
    const stats = await pool.query(`
      SELECT 
        COUNT(DISTINCT politico_nome) as politici_con_voti,
        COUNT(*) as totale_voti,
        COUNT(DISTINCT votazione) as votazioni_uniche,
        MAX(ultimo_aggiornamento) as ultimo_aggiornamento
      FROM voti_camera
      WHERE votazione IS NOT NULL AND votazione != ''
    `);
    
    console.log('\n📊 Statistiche Scraping:');
    console.log('─'.repeat(60));
    console.log(`Politici con voti: ${stats.rows[0].politici_con_voti}`);
    console.log(`Totale voti salvati: ${stats.rows[0].totale_voti}`);
    console.log(`Votazioni uniche: ${stats.rows[0].votazioni_uniche}`);
    console.log(`Ultimo aggiornamento: ${stats.rows[0].ultimo_aggiornamento || 'Nessuno'}`);
    console.log('─'.repeat(60));
    
    // Mostra alcuni esempi
    const examples = await pool.query(`
      SELECT 
        politico_nome,
        votazione,
        voto,
        data_votazione,
        url_openpolis
      FROM voti_camera
      WHERE votazione IS NOT NULL AND votazione != ''
      ORDER BY ultimo_aggiornamento DESC
      LIMIT 10
    `);
    
    if (examples.rows.length > 0) {
      console.log('\n📋 Ultimi 10 voti trovati:');
      examples.rows.forEach((row, i) => {
        console.log(`\n${i + 1}. ${row.politico_nome}`);
        console.log(`   Votazione: ${row.votazione?.substring(0, 60)}...`);
        console.log(`   Voto: ${row.voto}`);
        console.log(`   Data: ${row.data_votazione}`);
        console.log(`   URL: ${row.url_openpolis}`);
      });
    } else {
      console.log('\n⚠️ Nessun voto trovato ancora.');
    }
    
    // Verifica Maria Elena Boschi
    const boschi = await pool.query(`
      SELECT 
        politico_nome,
        url_openpolis,
        votazione,
        voto,
        data_votazione
      FROM voti_camera
      WHERE LOWER(politico_nome) LIKE '%maria%boschi%' OR LOWER(politico_nome) LIKE '%boschi%maria%'
      LIMIT 5
    `);
    
    if (boschi.rows.length > 0) {
      console.log('\n🔍 Maria Elena Boschi:');
      boschi.rows.forEach(row => {
        console.log(`   Nome: ${row.politico_nome}`);
        console.log(`   URL: ${row.url_openpolis}`);
        console.log(`   Ha voti: ${row.votazione ? 'Sì' : 'No'}`);
        if (row.votazione) {
          console.log(`   Ultima votazione: ${row.votazione.substring(0, 50)}...`);
        }
      });
    } else {
      console.log('\n⚠️ Maria Elena Boschi non trovata in voti_camera');
    }
    
  } catch (error) {
    console.error('❌ Errore:', error.message);
  } finally {
    await pool.end();
  }
}

checkResults();
