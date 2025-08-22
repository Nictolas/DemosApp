require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function checkUsersStructure() {
  try {
    console.log('🔍 Controllo struttura tabella users...');
    
    const query = `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position;
    `;
    
    const result = await pool.query(query);
    console.log('📋 Struttura tabella users:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} ${row.is_nullable === 'YES' ? '(nullable)' : '(NOT NULL)'} ${row.column_default ? `[default: ${row.column_default}]` : ''}`);
    });
    
    // Cerca specificamente la colonna ID
    const idColumn = result.rows.find(row => row.column_name.toLowerCase().includes('id'));
    if (idColumn) {
      console.log(`\n🎯 Colonna ID trovata: ${idColumn.column_name}`);
    } else {
      console.log('\n❌ Nessuna colonna ID trovata');
    }
    
  } catch (error) {
    console.error('❌ Errore durante il controllo della struttura:', error);
  } finally {
    await pool.end();
  }
}

checkUsersStructure();
