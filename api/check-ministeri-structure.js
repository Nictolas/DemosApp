require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkMinisteriStructure() {
  try {
    console.log('🔍 VERIFICA STRUTTURA TABELLA MINISTERI');
    console.log('=' .repeat(60));
    
    // 1. Conta record
    const countResult = await pool.query('SELECT COUNT(*) FROM ministeri');
    const count = parseInt(countResult.rows[0].count);
    console.log(`📊 Totale ministeri: ${count}`);
    
    // 2. Mostra struttura
    const structureResult = await pool.query('SELECT * FROM ministeri LIMIT 1');
    if (structureResult.rows.length > 0) {
      console.log('\n📋 Struttura colonne:');
      const columns = Object.keys(structureResult.rows[0]);
      columns.forEach((col, i) => console.log(`  ${i+1}. ${col}`));
    }
    
    // 3. Mostra alcuni record
    const recordsResult = await pool.query('SELECT * FROM ministeri LIMIT 5');
    console.log('\n📝 Primi 5 ministeri:');
    recordsResult.rows.forEach((row, i) => {
      console.log(`\n  Ministero ${i+1}:`);
      Object.keys(row).forEach(key => {
        console.log(`    - ${key}: ${row[key]}`);
      });
    });
    
  } catch (error) {
    console.error('❌ Errore:', error.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

checkMinisteriStructure();
