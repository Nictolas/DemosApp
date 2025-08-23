const { Pool } = require('pg');

// Configurazione database Neon
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/demos',
  ssl: process.env.DATABASE_URL ? {
    rejectUnauthorized: false
  } : false
});

async function checkTables() {
  try {
    console.log('🔍 Verifico tabelle esistenti nel database...\n');
    console.log('🔗 DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
    console.log('🔗 Usando connessione:', process.env.DATABASE_URL ? 'Neon' : 'Locale fallback');
    console.log('');
    
    // Lista delle tabelle da verificare
    const tablesToCheck = [
      'users',
      'opinioni',
      'voti_grazia',
      'voti_capo_stato',
      'voti_amnistia',
      'voti_ministri',
      'voti_iniziative_popolari',
      'voti_referendum_abrogativi',
      'iniziative_popolari',
      'ministeri'
    ];
    
    for (const tableName of tablesToCheck) {
      try {
        const result = await pool.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
          );
        `, [tableName]);
        
        const exists = result.rows[0].exists;
        const status = exists ? '✅ ESISTE' : '❌ NON ESISTE';
        console.log(`${status} - Tabella: ${tableName}`);
        
        if (exists) {
          // Conta i record
          const countResult = await pool.query(`SELECT COUNT(*) as count FROM ${tableName}`);
          const count = countResult.rows[0].count;
          console.log(`   📊 Record: ${count}`);
          
          // Mostra struttura se è la tabella opinioni
          if (tableName === 'opinioni') {
            const structureResult = await pool.query(`
              SELECT column_name, data_type 
              FROM information_schema.columns 
              WHERE table_name = $1 
              ORDER BY ordinal_position
            `, [tableName]);
            console.log('   🏗️  Struttura:');
            structureResult.rows.forEach(col => {
              console.log(`      - ${col.column_name}: ${col.data_type}`);
            });
          }
        }
        console.log('');
      } catch (error) {
        console.log(`❌ Errore nel verificare ${tableName}:`, error.message);
        console.log(`   🔍 Dettagli errore:`, error);
      }
    }
    
  } catch (error) {
    console.error('❌ Errore generale:', error);
  } finally {
    await pool.end();
  }
}

checkTables();
