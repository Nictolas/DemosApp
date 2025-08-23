require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkOpinioniStructure() {
  try {
    console.log('🔍 VERIFICA STRUTTURA TABELLA OPINIONI');
    console.log('=' .repeat(60));
    
    // 1. Conta record
    const countResult = await pool.query('SELECT COUNT(*) FROM opinioni');
    const count = parseInt(countResult.rows[0].count);
    console.log(`📊 Totale opinioni: ${count}`);
    
    // 2. Mostra struttura
    const structureResult = await pool.query('SELECT * FROM opinioni LIMIT 1');
    if (structureResult.rows.length > 0) {
      console.log('\n📋 Struttura colonne:');
      const columns = Object.keys(structureResult.rows[0]);
      columns.forEach((col, i) => console.log(`  ${i+1}. ${col}`));
    }
    
    // 3. Mostra alcuni record
    const recordsResult = await pool.query('SELECT * FROM opinioni LIMIT 3');
    console.log('\n📝 Primi 3 record:');
    recordsResult.rows.forEach((row, i) => {
      console.log(`\n  Opinione ${i+1}:`);
      Object.keys(row).forEach(key => {
        console.log(`    - ${key}: ${row[key]}`);
      });
    });
    
    // 4. Verifica se esiste categoria_id o categoria
    console.log('\n🔍 VERIFICA COLONNE CATEGORIA:');
    const columnsResult = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'opinioni' 
      AND column_name LIKE '%categoria%'
    `);
    
    if (columnsResult.rows.length > 0) {
      columnsResult.rows.forEach(row => {
        console.log(`  ✅ ${row.column_name}: ${row.data_type}`);
      });
    } else {
      console.log('  ❌ Nessuna colonna categoria trovata');
    }
    
  } catch (error) {
    console.error('❌ Errore:', error.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

checkOpinioniStructure();
