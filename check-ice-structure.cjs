const { pool } = require('./api/middleware/auth');

async function checkIceTable() {
  try {
    console.log('🔍 Verifico la struttura della tabella ice...');
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'ice' 
      ORDER BY ordinal_position
    `);
    console.log('Struttura tabella ice:');
    result.rows.forEach(row => {
      console.log(`- ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });
  } catch (error) {
    console.log('Errore:', error.message);
  }
  process.exit(0);
}

checkIceTable();
