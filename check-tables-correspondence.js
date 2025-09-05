const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkTables() {
  try {
    console.log('🔍 CONTROLLO TABELLA OPINIONI:');
    const opinioni = await pool.query('SELECT id, text, gradi_opinione FROM opinioni ORDER BY text');
    console.log('Opinioni trovate:', opinioni.rows.length);
    opinioni.rows.forEach(row => {
      console.log(`- ID: ${row.id} | Text: ${row.text} | Gradi: ${JSON.stringify(row.gradi_opinione)}`);
    });
    
    console.log('\n🔍 CONTROLLO COLONNE USERS:');
    const columns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND (column_name LIKE '%nucleare%' OR column_name LIKE '%caccia%' OR column_name LIKE '%comunale_%' OR column_name LIKE '%regionale_%')
      ORDER BY column_name
    `);
    console.log('Colonne opinioni in users:', columns.rows.length);
    columns.rows.forEach(row => {
      console.log(`- ${row.column_name}: ${row.data_type}`);
    });
    
  } catch (error) {
    console.error('❌ Errore:', error.message);
  } finally {
    await pool.end();
  }
}

checkTables();
