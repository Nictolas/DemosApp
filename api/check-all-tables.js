require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkAllTables() {
  try {
    console.log('🔍 VERIFICA COMPLETA TABELLE DATABASE NEON');
    console.log('=' .repeat(60));
    
    // 1. Ottieni tutte le tabelle
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log(`📊 Trovate ${tablesResult.rows.length} tabelle nel database:`);
    tablesResult.rows.forEach((row, i) => {
      console.log(`  ${i+1}. ${row.table_name}`);
    });
    
    // 2. Conta record per tabella
    console.log('\n📈 STATISTICHE RECORD PER TABELLA:');
    for (const row of tablesResult.rows) {
      try {
        const countResult = await pool.query(`SELECT COUNT(*) FROM "${row.table_name}"`);
        const count = parseInt(countResult.rows[0].count);
        console.log(`  ${row.table_name}: ${count} record`);
      } catch (error) {
        console.log(`  ${row.table_name}: ❌ Errore - ${error.message}`);
      }
    }
    
    // 3. Verifica tabelle mancanti critiche
    const tabelleCritiche = [
      'users',
      'opinioni',
      'voti_governo',
      'voti_amnistia',
      'voti_capo_stato',
      'voti_grazia',
      'voti_iniziative_popolari',
      'voti_referendum_abrogativi',
      'iniziative_popolari',
      'referendum_abrogativi',
      'ministeri',
      'categorie_opinioni',
      'categorie_rappresentanti'
    ];
    
    console.log('\n🔍 VERIFICA TABELLE CRITICHE:');
    const tabelleEsistenti = tablesResult.rows.map(row => row.table_name);
    
    tabelleCritiche.forEach(tabella => {
      if (tabelleEsistenti.includes(tabella)) {
        console.log(`  ✅ ${tabella}: ESISTE`);
      } else {
        console.log(`  ❌ ${tabella}: MANCANTE`);
      }
    });
    
  } catch (error) {
    console.error('❌ Errore:', error.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

checkAllTables();
