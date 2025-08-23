require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkVotiStatus() {
  try {
    console.log('🔍 VERIFICA STATO TABELLA VOTI_INIZIATIVE_POPOLARI');
    console.log('=' .repeat(60));
    
    // 1. Conta record
    const countResult = await pool.query('SELECT COUNT(*) FROM voti_iniziative_popolari');
    const count = parseInt(countResult.rows[0].count);
    console.log(`📊 Totale voti: ${count}`);
    
    // 2. Mostra struttura
    const structureResult = await pool.query('SELECT * FROM voti_iniziative_popolari LIMIT 1');
    if (structureResult.rows.length > 0) {
      console.log('\n📋 Struttura colonne:');
      const columns = Object.keys(structureResult.rows[0]);
      columns.forEach((col, i) => console.log(`  ${i+1}. ${col}`));
    }
    
    // 3. Mostra alcuni record
    const recordsResult = await pool.query('SELECT * FROM voti_iniziative_popolari LIMIT 5');
    console.log('\n📝 Primi 5 record:');
    recordsResult.rows.forEach((row, i) => {
      console.log(`\n  Record ${i+1}:`);
      console.log(`    - ID: ${row.id}`);
      console.log(`    - Iniziativa: ${row.iniziativa_id}`);
      console.log(`    - User: ${row.userid}`);
      console.log(`    - Timestamp: ${row.timestamp}`);
    });
    
    // 4. Conta voti per iniziativa
    const votiPerIniziativa = await pool.query(`
      SELECT iniziativa_id, COUNT(*) as voti
      FROM voti_iniziative_popolari 
      GROUP BY iniziativa_id 
      ORDER BY voti DESC
    `);
    
    console.log('\n📊 VOTI PER INIZIATIVA:');
    votiPerIniziativa.rows.forEach(row => {
      console.log(`  - ${row.iniziativa_id}: ${row.voti} voti`);
    });
    
  } catch (error) {
    console.error('❌ Errore:', error.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

checkVotiStatus();
