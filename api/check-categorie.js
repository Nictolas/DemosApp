const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/demos'
});

async function checkTables() {
  try {
    console.log('🔍 Controllo esistenza tabelle...\n');
    
    // Controlla categorie_opinioni
    try {
      const result1 = await pool.query('SELECT COUNT(*) FROM categorie_opinioni');
      console.log('✅ categorie_opinioni esiste con', result1.rows[0].count, 'record');
    } catch (error) {
      console.log('❌ categorie_opinioni NON esiste:', error.message);
    }
    
    // Controlla categorie_rappresentanti
    try {
      const result2 = await pool.query('SELECT COUNT(*) FROM categorie_rappresentanti');
      console.log('✅ categorie_rappresentanti esiste con', result2.rows[0].count, 'record');
    } catch (error) {
      console.log('❌ categorie_rappresentanti NON esiste:', error.message);
    }
    
    // Controlla opinioni
    try {
      const result3 = await pool.query('SELECT COUNT(*) FROM opinioni');
      console.log('✅ opinioni esiste con', result3.rows[0].count, 'record');
      
      // Controlla struttura
      const structure = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'opinioni' 
        ORDER BY ordinal_position
      `);
      console.log('📋 Struttura tabella opinioni:');
      structure.rows.forEach(col => {
        console.log(`   - ${col.column_name}: ${col.data_type}`);
      });
    } catch (error) {
      console.log('❌ opinioni NON esiste:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Errore generale:', error);
  } finally {
    await pool.end();
  }
}

checkTables();
