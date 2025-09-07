const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function checkTable() {
  try {
    const result = await pool.query('SELECT column_name, data_type FROM information_schema.columns WHERE table_name = \'voti_difesa\' ORDER BY ordinal_position');
    console.log('Colonne tabella voti_difesa:');
    result.rows.forEach(row => console.log(`- ${row.column_name}: ${row.data_type}`));
    
    const sample = await pool.query('SELECT * FROM voti_difesa LIMIT 2');
    console.log('\nDati di esempio:');
    console.log(JSON.stringify(sample.rows, null, 2));
    
    await pool.end();
  } catch (error) {
    console.error('Errore:', error.message);
    await pool.end();
  }
}

checkTable();
