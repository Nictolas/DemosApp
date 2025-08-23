require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkIniziative() {
  try {
    console.log('🔍 Controllo struttura tabella iniziative_popolari...');
    
    const result = await pool.query('SELECT * FROM iniziative_popolari LIMIT 3');
    
    console.log(`📊 Trovati ${result.rows.length} record`);
    
    if (result.rows.length > 0) {
      console.log('\n📋 Struttura colonne:');
      const columns = Object.keys(result.rows[0]);
      columns.forEach((col, i) => console.log(`${i+1}. ${col}`));
      
      console.log('\n📝 Primo record:');
      console.log(JSON.stringify(result.rows[0], null, 2));
    }
    
  } catch (error) {
    console.error('❌ Errore:', error.message);
  } finally {
    await pool.end();
  }
}

checkIniziative();
