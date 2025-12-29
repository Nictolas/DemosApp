// File: optimize-level-column.cjs
// Ottimizzazione colonna 'level' in centralized_logs

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function optimizeLevelColumn() {
  try {
    console.log('🚀 OTTIMIZZAZIONE COLONNA LEVEL');
    console.log('='.repeat(50));
    
    // 1. Crea tabella mapping
    console.log('\n📋 CREAZIONE TABELLA MAPPING...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS log_level_mapping (
        code CHAR(1) PRIMARY KEY,
        full_name VARCHAR(10) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Inserisci mapping
    const mappings = [
      { code: 'E', full_name: 'ERROR', description: 'Errori critici che richiedono attenzione immediata' },
      { code: 'W', full_name: 'WARN', description: 'Warning che potrebbero indicare problemi' },
      { code: 'I', full_name: 'INFO', description: 'Informazioni generali sul funzionamento' },
      { code: 'D', full_name: 'DEBUG', description: 'Informazioni dettagliate per debugging' },
      { code: 'T', full_name: 'TRACE', description: 'Informazioni molto dettagliate per tracciamento' }
    ];
    
    for (const mapping of mappings) {
      await pool.query(`
        INSERT INTO log_level_mapping (code, full_name, description)
        VALUES ($1, $2, $3)
        ON CONFLICT (code) DO UPDATE SET
          full_name = EXCLUDED.full_name,
          description = EXCLUDED.description
      `, [mapping.code, mapping.full_name, mapping.description]);
    }
    
    console.log('✅ Tabella mapping creata');
    
    // 2. Backup dati attuali
    console.log('\n💾 BACKUP DATI ATTUALI...');
    const backupResult = await pool.query(`
      CREATE TABLE IF NOT EXISTS centralized_logs_backup_level AS 
      SELECT * FROM centralized_logs
    `);
    console.log(`✅ Backup creato: ${backupResult.rowCount} record`);
    
    // 3. Aggiungi colonna temporanea
    console.log('\n🔧 AGGIUNTA COLONNA TEMPORANEA...');
    await pool.query(`
      ALTER TABLE centralized_logs 
      ADD COLUMN IF NOT EXISTS level_code CHAR(1)
    `);
    console.log('✅ Colonna level_code aggiunta');
    
    // 4. Popola codici ottimizzati
    console.log('\n📝 POPOLAMENTO CODICI OTTIMIZZATI...');
    const updateResult = await pool.query(`
      UPDATE centralized_logs 
      SET level_code = 
        CASE level
          WHEN 'ERROR' THEN 'E'
          WHEN 'WARN' THEN 'W'
          WHEN 'INFO' THEN 'I'
          WHEN 'DEBUG' THEN 'D'
          WHEN 'TRACE' THEN 'T'
          ELSE 'U'
        END
    `);
    console.log(`✅ Codici aggiornati: ${updateResult.rowCount} record`);
    
    // 5. Verifica migrazione
    console.log('\n🔍 VERIFICA MIGRAZIONE...');
    const verification = await pool.query(`
      SELECT 
        level_code,
        COUNT(*) as count,
        pg_size_pretty(SUM(pg_column_size(level_code))) as size
      FROM centralized_logs 
      GROUP BY level_code 
      ORDER BY count DESC
    `);
    
    console.log('📊 Distribuzione codici ottimizzati:');
    verification.rows.forEach(row => {
      console.log(`   ${row.level_code}: ${row.count.toLocaleString()} record (${row.size})`);
    });
    
    // 6. Rimuovi colonna vecchia e rinomina
    console.log('\n🗑️ RIMOZIONE COLONNA VECCHIA...');
    await pool.query(`ALTER TABLE centralized_logs DROP COLUMN IF EXISTS level`);
    await pool.query(`ALTER TABLE centralized_logs RENAME COLUMN level_code TO level`);
    console.log('✅ Colonna ottimizzata');
    
    // 7. Aggiorna indici
    console.log('\n🔍 AGGIORNAMENTO INDICI...');
    await pool.query(`DROP INDEX IF EXISTS idx_centralized_logs_level`);
    await pool.query(`CREATE INDEX idx_centralized_logs_level ON centralized_logs(level)`);
    console.log('✅ Indici aggiornati');
    
    // 8. VACUUM per liberare spazio
    console.log('\n🧹 PULIZIA SPAZIO...');
    await pool.query(`VACUUM FULL centralized_logs`);
    console.log('✅ Spazio liberato');
    
    // 9. Statistiche finali
    console.log('\n📊 STATISTICHE FINALI:');
    const finalStats = await pool.query(`
      SELECT 
        pg_size_pretty(pg_total_relation_size('centralized_logs')) as table_size,
        COUNT(*) as total_records,
        pg_size_pretty(SUM(pg_column_size(level))) as level_column_size
      FROM centralized_logs
    `);
    
    const stats = finalStats.rows[0];
    console.log(`💾 Dimensione tabella: ${stats.table_size}`);
    console.log(`📈 Record totali: ${stats.total_records.toLocaleString()}`);
    console.log(`📏 Dimensione colonna level: ${stats.level_column_size}`);
    
    console.log('\n🎉 OTTIMIZZAZIONE COMPLETATA!');
    console.log('📋 Prossimi passi:');
    console.log('   1. Aggiorna codice applicazione per usare nuovi codici');
    console.log('   2. Testa funzionalità di conversione');
    console.log('   3. Monitora performance');
    
  } catch (error) {
    console.error('❌ Errore durante ottimizzazione:', error);
    
    // Rollback in caso di errore
    console.log('\n🔄 TENTATIVO ROLLBACK...');
    try {
      await pool.query(`ALTER TABLE centralized_logs DROP COLUMN IF EXISTS level_code`);
      console.log('✅ Rollback completato');
    } catch (rollbackError) {
      console.error('❌ Errore rollback:', rollbackError);
    }
  } finally {
    await pool.end();
  }
}

// Esegui ottimizzazione
if (require.main === module) {
  optimizeLevelColumn();
}

module.exports = { optimizeLevelColumn };
