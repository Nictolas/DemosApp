const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Lista dei ministeri
const ministeri = [
  'difesa', 'economia', 'esteri', 'giustizia', 'interno', 
  'istruzione', 'lavoro', 'salute', 'trasporti', 'ambiente', 
  'cultura', 'sport'
];

async function migrateVotiMinisteri() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Inizio migrazione dati da voti_ministri alle tabelle separate...\n');
    
    await client.query('BEGIN');
    
    // Prima controlla quanti record ci sono da migrare
    const checkQuery = 'SELECT COUNT(*) as count FROM voti_ministri';
    const checkResult = await client.query(checkQuery);
    const totalRecords = parseInt(checkResult.rows[0].count);
    
    console.log(`📊 Record da migrare: ${totalRecords}`);
    
    if (totalRecords === 0) {
      console.log('✅ Nessun dato da migrare');
      await client.query('COMMIT');
      return;
    }
    
    let totalMigrated = 0;
    
    // Migra per ogni ministero
    for (const ministero of ministeri) {
      const tableName = `voti_ministro_${ministero}`;
      
      console.log(`🔄 Migrazione per ${ministero}...`);
      
      // Conta record da migrare per questo ministero
      const countQuery = `
        SELECT COUNT(*) as count 
        FROM voti_ministri 
        WHERE categoria = $1
      `;
      const countResult = await client.query(countQuery, [ministero]);
      const recordsToMigrate = parseInt(countResult.rows[0].count);
      
      if (recordsToMigrate > 0) {
        const migrateQuery = `
          INSERT INTO ${tableName} (id, userid, nome_ministro, nome_display, timestamp)
          SELECT id, userid, nome_ministro, nome_display, timestamp
          FROM voti_ministri 
          WHERE categoria = $1
        `;
        
        const result = await client.query(migrateQuery, [ministero]);
        console.log(`✅ Migrati ${result.rowCount} record per ${ministero}`);
        totalMigrated += result.rowCount;
      } else {
        console.log(`⏭️  Nessun record per ${ministero}`);
      }
    }
    
    // Verifica migrazione
    console.log('\n📊 Verifica migrazione:');
    let totalInNewTables = 0;
    for (const ministero of ministeri) {
      const tableName = `voti_ministro_${ministero}`;
      const countQuery = `SELECT COUNT(*) as count FROM ${tableName}`;
      const countResult = await client.query(countQuery);
      const count = parseInt(countResult.rows[0].count);
      totalInNewTables += count;
      console.log(`📋 ${tableName}: ${count} record`);
    }
    
    console.log(`\n📊 Record originali: ${totalRecords}`);
    console.log(`📊 Record migrati: ${totalMigrated}`);
    console.log(`📊 Record nelle nuove tabelle: ${totalInNewTables}`);
    
    if (totalRecords === totalMigrated && totalRecords === totalInNewTables) {
      console.log('\n🎉 MIGRAZIONE COMPLETATA CON SUCCESSO! ✅');
      await client.query('COMMIT');
    } else {
      console.log('\n⚠️  ATTENZIONE: numero record non corrisponde!');
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

// Esegui migrazione
migrateVotiMinisteri()
  .then(() => {
    console.log('\n✅ Script di migrazione completato');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Errore durante la migrazione:', error);
    process.exit(1);
  });
