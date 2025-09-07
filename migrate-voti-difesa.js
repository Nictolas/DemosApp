const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function migrateVotiDifesa() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Migrazione voti difesa da voti_ministri a voti_difesa...\n');
    
    await client.query('BEGIN');
    
    // Prima controlla quanti record ci sono da migrare
    const checkQuery = `
      SELECT COUNT(*) as count 
      FROM voti_ministri 
      WHERE categoria = 'difesa'
    `;
    const checkResult = await client.query(checkQuery);
    const recordsToMigrate = parseInt(checkResult.rows[0].count);
    
    console.log(`📊 Record da migrare per difesa: ${recordsToMigrate}`);
    
    if (recordsToMigrate === 0) {
      console.log('✅ Nessun dato da migrare per difesa');
      await client.query('COMMIT');
      return;
    }
    
    // Migra i dati
    const migrateQuery = `
      INSERT INTO voti_difesa (id, userid, nome_ministro, nome_display, timestamp)
      SELECT id, userid, nome_ministro, nome_display, timestamp
      FROM voti_ministri 
      WHERE categoria = 'difesa'
    `;
    
    const result = await client.query(migrateQuery);
    console.log(`✅ Migrati ${result.rowCount} record per difesa`);
    
    // Verifica migrazione
    const verifyQuery = 'SELECT COUNT(*) as count FROM voti_difesa';
    const verifyResult = await client.query(verifyQuery);
    const migratedCount = parseInt(verifyResult.rows[0].count);
    
    console.log(`📊 Record nella tabella voti_difesa: ${migratedCount}`);
    
    if (recordsToMigrate === migratedCount) {
      console.log('🎉 MIGRAZIONE COMPLETATA CON SUCCESSO! ✅');
      await client.query('COMMIT');
    } else {
      console.log('⚠️  ATTENZIONE: numero record non corrisponde!');
      console.log('🔄 Rollback della transazione...');
      await client.query('ROLLBACK');
    }
    
  } catch (error) {
    console.error('❌ Errore nella migrazione:', error.message);
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrateVotiDifesa()
  .then(() => {
    console.log('\n✅ Script di migrazione completato');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Errore durante la migrazione:', error);
    process.exit(1);
  });
