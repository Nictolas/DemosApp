const { pool } = require('./api/middleware/auth');

async function checkTable() {
  try {
    console.log('🔍 Verifico se esiste la tabella iniziative_popolari...');
    
    // Prima controllo se la tabella esiste
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'iniziative_popolari'
      );
    `);
    
    console.log('Tabella iniziative_popolari esiste:', tableExists.rows[0].exists);
    
    if (tableExists.rows[0].exists) {
      // Se esiste, mostro la struttura
      const result = await pool.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'iniziative_popolari' 
        ORDER BY ordinal_position
      `);
      console.log('Struttura tabella iniziative_popolari:');
      result.rows.forEach(row => {
        console.log(`- ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
      });
    } else {
      console.log('La tabella iniziative_popolari non esiste ancora.');
    }
    
  } catch (error) {
    console.log('Errore:', error.message);
  }
  process.exit(0);
}

checkTable();
