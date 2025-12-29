const { pool } = require('./api/middleware/auth');
const fs = require('fs');

async function migrateReferendumAbrogativi() {
  try {
    console.log('🔧 Migrazione tabella referendum_abrogativi per renderla uguale alla tabella ice...');
    
    // Leggi il file SQL
    const sqlContent = fs.readFileSync('./update-referendum-abrogativi-schema.sql', 'utf8');
    
    // Esegui le query SQL
    const queries = sqlContent.split(';').filter(query => query.trim());
    
    for (const query of queries) {
      if (query.trim()) {
        try {
          console.log(`🔍 Eseguendo: ${query.trim().substring(0, 50)}...`);
          await pool.query(query);
          console.log('✅ Query eseguita con successo');
        } catch (error) {
          console.log(`⚠️ Errore nell'esecuzione della query:`, error.message);
        }
      }
    }
    
    console.log('\n✅ Migrazione completata!');
    
    // Verifica la struttura finale
    console.log('\n📋 Struttura finale della tabella referendum_abrogativi:');
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'referendum_abrogativi' 
      ORDER BY ordinal_position
    `);
    
    result.rows.forEach(row => {
      console.log(`- ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });
    
  } catch (error) {
    console.log('❌ Errore nella migrazione:', error.message);
  }
  process.exit(0);
}

migrateReferendumAbrogativi();