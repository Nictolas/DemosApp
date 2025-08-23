const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function checkTables() {
  try {
    console.log('🔍 Controllo tabelle esistenti nel database...\n');
    
    // Query per ottenere tutte le tabelle
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `;
    
    const tablesResult = await pool.query(tablesQuery);
    
    console.log('📋 Tabelle esistenti:');
    tablesResult.rows.forEach((row, index) => {
      console.log(`${index + 1}. ${row.table_name}`);
    });
    
    console.log(`\n✅ Totale: ${tablesResult.rows.length} tabelle trovate`);
    
    // Controllo specifico per le tabelle problematiche
    console.log('\n🔍 Controllo tabelle problematiche:');
    
    const problematicTables = ['opinioni', 'voti_governo', 'categorie_opinioni'];
    
    for (const table of problematicTables) {
      try {
        const checkQuery = `SELECT COUNT(*) FROM ${table}`;
        const result = await pool.query(checkQuery);
        console.log(`✅ ${table}: ${result.rows[0].count} record`);
      } catch (error) {
        console.log(`❌ ${table}: NON ESISTE - ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Errore nel controllo tabelle:', error);
  } finally {
    await pool.end();
  }
}

checkTables();
