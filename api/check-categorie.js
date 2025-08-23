require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkCategorie() {
  try {
    console.log('🔍 VERIFICA TABELLE CATEGORIE');
    console.log('=' .repeat(60));
    
    // 1. Verifica categorie_opinioni
    try {
      const opinioniResult = await pool.query('SELECT COUNT(*) FROM categorie_opinioni');
      const count = parseInt(opinioniResult.rows[0].count);
      console.log(`✅ categorie_opinioni: ${count} record`);
      
      // Mostra alcune categorie
      const categorieResult = await pool.query('SELECT * FROM categorie_opinioni LIMIT 5');
      console.log('\n📋 Categorie opinioni:');
      categorieResult.rows.forEach(row => {
        console.log(`  - ${row.nome || 'Nome mancante'}`);
      });
      
    } catch (error) {
      console.log(`❌ categorie_opinioni: ${error.message}`);
    }
    
    // 2. Verifica categorie_rappresentanti
    try {
      const rappresentantiResult = await pool.query('SELECT COUNT(*) FROM categorie_rappresentanti');
      const count = parseInt(rappresentantiResult.rows[0].count);
      console.log(`✅ categorie_rappresentanti: ${count} record`);
      
      // Mostra alcune categorie
      const categorieResult = await pool.query('SELECT * FROM categorie_rappresentanti LIMIT 5');
      console.log('\n📋 Categorie rappresentanti:');
      categorieResult.rows.forEach(row => {
        console.log(`  - ${row.nome || 'Nome mancante'}`);
      });
      
    } catch (error) {
      console.log(`❌ categorie_rappresentanti: ${error.message}`);
    }
    
    // 3. Verifica se esistono altre tabelle simili
    console.log('\n🔍 CERCA TABELLE SIMILI:');
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE '%categoria%'
      ORDER BY table_name
    `);
    
    if (tablesResult.rows.length > 0) {
      console.log('📋 Tabelle trovate con "categoria":');
      tablesResult.rows.forEach(row => {
        console.log(`  - ${row.table_name}`);
      });
    } else {
      console.log('  Nessuna tabella con "categoria" trovata');
    }
    
  } catch (error) {
    console.error('❌ Errore:', error.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

checkCategorie();
