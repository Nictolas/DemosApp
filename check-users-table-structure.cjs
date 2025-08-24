const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkUsersTableStructure() {
  try {
    console.log('🔍 Verifica struttura tabella users...');
    
    // Verifica tutte le colonne
    const query = `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position
    `;
    
    const result = await pool.query(query);
    
    console.log(`📋 Trovate ${result.rows.length} colonne:`);
    result.rows.forEach((column, index) => {
      console.log(`${index + 1}. ${column.column_name}: ${column.data_type} (nullable: ${column.is_nullable})`);
    });
    
    // Verifica se esistono le colonne specifiche
    const specificColumns = ['updated_at', 'reset_token', 'reset_token_expires'];
    console.log('\n🔍 Verifica colonne specifiche:');
    
    specificColumns.forEach(col => {
      const found = result.rows.find(r => r.column_name === col);
      if (found) {
        console.log(`✅ ${col}: ${found.data_type}`);
      } else {
        console.log(`❌ ${col}: NON TROVATA`);
      }
    });
    
  } catch (error) {
    console.error('❌ Errore:', error);
  } finally {
    await pool.end();
  }
}

checkUsersTableStructure();
