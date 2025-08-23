require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkVotiMinistri() {
  try {
    console.log('🔍 VERIFICA TABELLA VOTI_MINISTRI');
    console.log('=' .repeat(60));
    
    // 1. Conta record
    const countResult = await pool.query('SELECT COUNT(*) FROM voti_ministri');
    const count = parseInt(countResult.rows[0].count);
    console.log(`📊 Totale record: ${count}`);
    
    // 2. Mostra struttura
    const structureResult = await pool.query('SELECT * FROM voti_ministri LIMIT 1');
    if (structureResult.rows.length > 0) {
      console.log('\n📋 Struttura colonne:');
      const columns = Object.keys(structureResult.rows[0]);
      columns.forEach((col, i) => console.log(`  ${i+1}. ${col}`));
    }
    
    // 3. Mostra alcuni record
    const recordsResult = await pool.query('SELECT * FROM voti_ministri LIMIT 5');
    console.log('\n📝 Primi 5 record:');
    recordsResult.rows.forEach((row, i) => {
      console.log(`\n  Record ${i+1}:`);
      Object.keys(row).forEach(key => {
        console.log(`    - ${key}: ${row[key]}`);
      });
    });
    
    // 4. Conta voti per ministero
    const votiPerMinistero = await pool.query(`
      SELECT ministero_id, COUNT(*) as voti
      FROM voti_ministri 
      GROUP BY ministero_id 
      ORDER BY voti DESC
    `);
    
    console.log('\n📊 VOTI PER MINISTERO:');
    votiPerMinistero.rows.forEach(row => {
      console.log(`  - Ministero ${row.ministero_id}: ${row.voti} voti`);
    });
    
  } catch (error) {
    console.error('❌ Errore:', error.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

checkVotiMinistri();
