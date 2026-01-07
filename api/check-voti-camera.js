require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkData() {
  try {
    const result = await pool.query(`
      SELECT 
        politico_nome, 
        camera, 
        SUBSTRING(votazione, 1, 100) as votazione_short, 
        voto, 
        data_votazione,
        ultimo_aggiornamento
      FROM voti_camera 
      ORDER BY politico_nome
    `);
    
    console.log('='.repeat(60));
    console.log('DATI SALVATI NELLA TABELLA voti_camera');
    console.log('='.repeat(60));
    
    result.rows.forEach((row, idx) => {
      console.log(`\n${idx + 1}. ${row.politico_nome} (${row.camera})`);
      console.log(`   Votazione: ${row.votazione_short || 'N/A'}...`);
      console.log(`   Voto: ${row.voto || 'N/A'}`);
      console.log(`   Data: ${row.data_votazione || 'N/A'}`);
      console.log(`   Ultimo aggiornamento: ${row.ultimo_aggiornamento || 'N/A'}`);
    });
    
    console.log(`\n[OK] Totale: ${result.rows.length} politici`);
    
  } catch (error) {
    console.error('[ERR]', error.message);
  } finally {
    await pool.end();
  }
}

checkData();

