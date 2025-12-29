// File: optimize-centralized-logs-aggressive.cjs
// Ottimizzazione aggressiva dei centralized_logs per ridurre dimensioni

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * OTTIMIZZAZIONE AGGRESSIVA CENTRALIZED_LOGS
 * 
 * Strategia per ridurre le dimensioni mantenendo conformità GDPR:
 * 1. Compattazione metadata ridondanti
 * 2. Eliminazione log duplicati/non essenziali
 * 3. Ottimizzazione campi di testo
 * 4. Implementazione retention policy più aggressiva
 */

async function optimizeCentralizedLogsAggressive() {
  try {
    console.log('🚀 OTTIMIZZAZIONE AGGRESSIVA CENTRALIZED_LOGS');
    console.log('='.repeat(60));
    
    // 1. Analisi pre-ottimizzazione
    const preStats = await getDetailedStats();
    console.log('\n📊 STATISTICHE PRE-OTTIMIZZAZIONE:');
    showDetailedStats(preStats);
    
    // 2. Backup di sicurezza
    await createSafetyBackup();
    
    // 3. Ottimizzazioni
    const results = await performAggressiveOptimizations();
    
    // 4. Analisi post-ottimizzazione
    const postStats = await getDetailedStats();
    console.log('\n📊 STATISTICHE POST-OTTIMIZZAZIONE:');
    showDetailedStats(postStats);
    
    // 5. Risultati finali
    showOptimizationResults(preStats, postStats, results);
    
    // 6. Configurazione retention automatica
    await setupAutomaticRetention();
    
  } catch (error) {
    console.error('❌ Errore durante ottimizzazione:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

/**
 * Ottiene statistiche dettagliate
 */
async function getDetailedStats() {
  const stats = await pool.query(`
    SELECT 
      COUNT(*) as total_records,
      COUNT(CASE WHEN level = 'ERROR' THEN 1 END) as error_count,
      COUNT(CASE WHEN level = 'WARN' THEN 1 END) as warn_count,
      COUNT(CASE WHEN level = 'INFO' THEN 1 END) as info_count,
      COUNT(CASE WHEN level = 'DEBUG' THEN 1 END) as debug_count,
      COUNT(CASE WHEN level = 'TRACE' THEN 1 END) as trace_count,
      pg_size_pretty(pg_total_relation_size('centralized_logs')) as table_size,
      SUM(pg_column_size(message)) as total_message_size,
      SUM(pg_column_size(meta_data)) as total_metadata_size,
      AVG(pg_column_size(message)) as avg_message_size,
      AVG(pg_column_size(meta_data)) as avg_metadata_size_bytes,
      MIN(timestamp) as oldest_record,
      MAX(timestamp) as newest_record
    FROM centralized_logs
  `);
  
  return stats.rows[0];
}

/**
 * Mostra statistiche dettagliate
 */
function showDetailedStats(stats) {
  console.log(`📈 Record totali: ${stats.total_records.toLocaleString()}`);
  console.log(`🔴 ERROR: ${stats.error_count.toLocaleString()}`);
  console.log(`🟡 WARN:  ${stats.warn_count.toLocaleString()}`);
  console.log(`🔵 INFO:  ${stats.info_count.toLocaleString()}`);
  console.log(`🟢 DEBUG: ${stats.debug_count.toLocaleString()}`);
  console.log(`⚪ TRACE: ${stats.trace_count.toLocaleString()}`);
  console.log(`💾 Dimensione tabella: ${stats.table_size}`);
  console.log(`📝 Dimensione totale messaggi: ${Math.round(stats.total_message_size / 1024)} KB`);
  console.log(`📦 Dimensione totale metadata: ${Math.round(stats.total_metadata_size / 1024)} KB`);
  console.log(`📏 Dimensione media messaggio: ${Math.round(stats.avg_message_size)} bytes`);
  console.log(`📏 Dimensione media metadata: ${Math.round(stats.avg_metadata_size_bytes)} bytes`);
  console.log(`📅 Range: ${stats.oldest_record} → ${stats.newest_record}`);
}

/**
 * Crea backup di sicurezza
 */
async function createSafetyBackup() {
  console.log('\n💾 CREAZIONE BACKUP DI SICUREZZA...');
  
  try {
    // Crea tabella backup se non esiste
    await pool.query(`
      CREATE TABLE IF NOT EXISTS centralized_logs_backup_optimization AS 
      SELECT * FROM centralized_logs WHERE 1=0
    `);
    
    // Backup di un campione rappresentativo (10% dei dati)
    const backupQuery = `
      INSERT INTO centralized_logs_backup_optimization
      SELECT * FROM centralized_logs 
      WHERE id IN (
        SELECT id FROM centralized_logs 
        ORDER BY RANDOM() 
        LIMIT (SELECT COUNT(*) / 10 FROM centralized_logs)
      )
    `;
    
    const result = await pool.query(backupQuery);
    console.log(`✅ Backup di sicurezza creato: ${result.rowCount} record salvati`);
    
  } catch (error) {
    console.log('⚠️ Backup non disponibile, continuo con ottimizzazione...');
  }
}

/**
 * Esegue ottimizzazioni aggressive
 */
async function performAggressiveOptimizations() {
  console.log('\n🔧 ESECUZIONE OTTIMIZZAZIONI AGGRESSIVE...');
  const results = {};
  
  // 1. Elimina log duplicati (stesso messaggio, stesso timestamp, stesso utente)
  console.log('\n1. 🗑️ Eliminazione log duplicati...');
  const duplicatesQuery = `
    DELETE FROM centralized_logs 
    WHERE id NOT IN (
      SELECT MIN(id::text)::uuid 
      FROM centralized_logs 
      GROUP BY message, timestamp, user_id, level
    )
  `;
  
  const duplicatesResult = await pool.query(duplicatesQuery);
  results.duplicates_removed = duplicatesResult.rowCount;
  console.log(`   ✅ Eliminati ${duplicatesResult.rowCount.toLocaleString()} log duplicati`);
  
  // 2. Comprimi metadata ridondanti
  console.log('\n2. 📦 Compressione metadata...');
  const metadataQuery = `
    UPDATE centralized_logs 
    SET meta_data = jsonb_strip_nulls(
      jsonb_build_object(
        'userId', CASE WHEN user_id IS NOT NULL THEN user_id ELSE NULL END,
        'ipAddress', CASE WHEN ip_address IS NOT NULL THEN ip_address ELSE NULL END,
        'endpoint', CASE WHEN endpoint IS NOT NULL THEN endpoint ELSE NULL END,
        'requestId', CASE WHEN request_id IS NOT NULL THEN request_id ELSE NULL END,
        'sessionId', CASE WHEN session_id IS NOT NULL THEN session_id ELSE NULL END
      )
    )
    WHERE meta_data IS NOT NULL AND meta_data != '{}'
  `;
  
  const metadataResult = await pool.query(metadataQuery);
  results.metadata_compressed = metadataResult.rowCount;
  console.log(`   ✅ Comprimi ${metadataResult.rowCount.toLocaleString()} record metadata`);
  
  // 3. Tronca messaggi troppo lunghi (mantieni primi 500 caratteri)
  console.log('\n3. ✂️ Troncamento messaggi lunghi...');
  const truncateQuery = `
    UPDATE centralized_logs 
    SET message = LEFT(message, 500) || '... [TRUNCATED]'
    WHERE LENGTH(message) > 500
  `;
  
  const truncateResult = await pool.query(truncateQuery);
  results.messages_truncated = truncateResult.rowCount;
  console.log(`   ✅ Troncati ${truncateResult.rowCount.toLocaleString()} messaggi lunghi`);
  
  // 4. Elimina log non essenziali (solo per livelli INFO generici)
  console.log('\n4. 🧹 Eliminazione log non essenziali...');
  const nonEssentialQuery = `
    DELETE FROM centralized_logs 
    WHERE level = 'INFO' 
      AND (
        message ILIKE '%request%' OR
        message ILIKE '%response%' OR
        message ILIKE '%middleware%' OR
        message ILIKE '%route%'
      )
      AND timestamp < NOW() - INTERVAL '7 days'
  `;
  
  const nonEssentialResult = await pool.query(nonEssentialQuery);
  results.non_essential_removed = nonEssentialResult.rowCount;
  console.log(`   ✅ Eliminati ${nonEssentialResult.rowCount.toLocaleString()} log non essenziali`);
  
  // 5. Implementa retention policy più aggressiva per INFO
  console.log('\n5. ⏰ Retention policy aggressiva...');
  const retentionQuery = `
    DELETE FROM centralized_logs 
    WHERE level = 'INFO' 
      AND timestamp < NOW() - INTERVAL '30 days'
      AND message NOT ILIKE '%error%'
      AND message NOT ILIKE '%security%'
      AND message NOT ILIKE '%audit%'
      AND message NOT ILIKE '%authentication%'
  `;
  
  const retentionResult = await pool.query(retentionQuery);
  results.retention_cleaned = retentionResult.rowCount;
  console.log(`   ✅ Eliminati ${retentionResult.rowCount.toLocaleString()} log INFO vecchi`);
  
  return results;
}

/**
 * Mostra risultati dell'ottimizzazione
 */
function showOptimizationResults(preStats, postStats, results) {
  console.log('\n🎯 RISULTATI OTTIMIZZAZIONE:');
  console.log('='.repeat(50));
  
  const recordsRemoved = preStats.total_records - postStats.total_records;
  const reductionPercent = Math.round((recordsRemoved / preStats.total_records) * 100);
  
  console.log(`📉 Record eliminati: ${recordsRemoved.toLocaleString()}`);
  console.log(`📊 Record rimanenti: ${postStats.total_records.toLocaleString()}`);
  console.log(`💾 Riduzione: ${reductionPercent}%`);
  
  console.log('\n📋 DETTAGLIO OTTIMIZZAZIONI:');
  Object.entries(results).forEach(([operation, count]) => {
    if (count > 0) {
      const operationName = operation.replace(/_/g, ' ').toUpperCase();
      console.log(`   ${operationName}: ${count.toLocaleString()} record`);
    }
  });
  
  // Stima risparmio spazio
  const avgRecordSize = 1024; // bytes
  const spaceSavedMB = Math.round((recordsRemoved * avgRecordSize) / (1024 * 1024));
  console.log(`\n💾 Spazio liberato: ~${spaceSavedMB} MB`);
  
  // Calcola riduzione percentuale dimensioni
  const preSizeMB = parseInt(preStats.table_size.replace(' MB', ''));
  const postSizeMB = parseInt(postStats.table_size.replace(' MB', ''));
  const sizeReduction = preSizeMB - postSizeMB;
  const sizeReductionPercent = Math.round((sizeReduction / preSizeMB) * 100);
  
  console.log(`📊 Riduzione dimensioni: ${sizeReduction} MB (${sizeReductionPercent}%)`);
  console.log(`💾 Dimensione finale: ${postStats.table_size}`);
}

/**
 * Configura retention automatica
 */
async function setupAutomaticRetention() {
  console.log('\n⚙️ CONFIGURAZIONE RETENTION AUTOMATICA...');
  
  try {
    // Crea tabella per configurazione retention
    await pool.query(`
      CREATE TABLE IF NOT EXISTS log_retention_config (
        id SERIAL PRIMARY KEY,
        level VARCHAR(10) NOT NULL,
        retention_days INTEGER NOT NULL,
        enabled BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Inserisci configurazione retention
    const retentionConfig = [
      { level: 'ERROR', days: 730 },   // 2 anni
      { level: 'WARN', days: 365 },    // 1 anno
      { level: 'INFO', days: 90 },     // 3 mesi (più aggressivo)
      { level: 'DEBUG', days: 7 },     // 1 settimana
      { level: 'TRACE', days: 1 }      // 1 giorno
    ];
    
    for (const config of retentionConfig) {
      await pool.query(`
        INSERT INTO log_retention_config (level, retention_days, enabled)
        VALUES ($1, $2, true)
        ON CONFLICT (level) DO UPDATE SET
          retention_days = EXCLUDED.retention_days,
          enabled = EXCLUDED.enabled
      `, [config.level, config.days]);
    }
    
    console.log('✅ Configurazione retention automatica creata');
    console.log('📋 Policy configurate:');
    retentionConfig.forEach(config => {
      console.log(`   ${config.level}: ${config.days} giorni`);
    });
    
  } catch (error) {
    console.log('⚠️ Errore configurazione retention:', error.message);
  }
}

/**
 * Funzione per esecuzione immediata
 */
async function runImmediateOptimization() {
  try {
    console.log('🚀 Avvio ottimizzazione aggressiva...');
    await optimizeCentralizedLogsAggressive();
    console.log('\n🎉 Ottimizzazione completata con successo!');
  } catch (error) {
    console.error('💥 Errore durante ottimizzazione:', error);
    process.exit(1);
  }
}

// Esegui se chiamato direttamente
if (require.main === module) {
  runImmediateOptimization();
}

module.exports = { 
  optimizeCentralizedLogsAggressive,
  runImmediateOptimization
};
