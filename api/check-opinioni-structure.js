const { Pool } = require('pg');

// Configurazione database Neon
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/demos',
  ssl: process.env.DATABASE_URL ? {
    rejectUnauthorized: false
  } : false
});

async function checkOpinioniStructure() {
  try {
    console.log('🔍 Verifico struttura tabella opinioni...\n');
    
    // Controlla se la tabella esiste
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'opinioni'
      );
    `);
    
    if (!tableExists.rows[0].exists) {
      console.log('❌ Tabella "opinioni" non esiste');
      return;
    }
    
    console.log('✅ Tabella "opinioni" esiste');
    
    // Controlla la struttura della tabella
    const structure = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'opinioni'
      ORDER BY ordinal_position;
    `);
    
    console.log('\n📋 Struttura tabella opinioni:');
    structure.rows.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'NOT NULL'})`);
    });
    
    // Controlla se ci sono dati
    const count = await pool.query('SELECT COUNT(*) FROM opinioni');
    console.log(`\n📊 Numero di record: ${count.rows[0].count}`);
    
    // Mostra alcuni esempi di dati
    if (parseInt(count.rows[0].count) > 0) {
      const sample = await pool.query('SELECT * FROM opinioni LIMIT 3');
      console.log('\n📝 Esempi di dati:');
      sample.rows.forEach((row, i) => {
        console.log(`\n   Record ${i + 1}:`);
        Object.entries(row).forEach(([key, value]) => {
          console.log(`     ${key}: ${value}`);
        });
      });
    }
    
  } catch (error) {
    console.error('❌ Errore:', error.message);
  } finally {
    await pool.end();
  }
}

checkOpinioniStructure();
