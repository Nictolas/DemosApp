const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function checkVotiCapoStato() {
  try {
    const client = await pool.connect();
    console.log('✅ Connesso al database');
    
    // Controlla la struttura della tabella voti_capo_stato
    const structure = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'voti_capo_stato'
      ORDER BY ordinal_position
    `);
    
    console.log('🔍 Struttura tabella voti_capo_stato:');
    structure.rows.forEach(col => {
      console.log(`- ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });
    
    // Controlla i dati nella tabella
    const data = await client.query(`
      SELECT * FROM voti_capo_stato 
      ORDER BY timestamp DESC 
      LIMIT 10
    `);
    
    console.log('\n🔍 Dati nella tabella voti_capo_stato (ultimi 10):');
    console.log('Righe trovate:', data.rows.length);
    data.rows.forEach((row, i) => {
      console.log(`${i+1}. ID: ${row.id}, Nome: ${row.nome}, UserID: ${row.userid || row.utente_id}, Timestamp: ${row.timestamp || row.data_voto}`);
    });
    
    client.release();
    await pool.end();
  } catch (error) {
    console.error('❌ Errore:', error);
    await pool.end();
  }
}

checkVotiCapoStato();
