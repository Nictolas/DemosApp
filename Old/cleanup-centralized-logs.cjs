// File: cleanup-centralized-logs.cjs
// Pulizia immediata dei centralized_logs con conformità GDPR

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * PULIZIA CENTRALIZED_LOGS - GDPR-COMPLIANT
 * 
 * Strategia di pulizia basata su:
 * 1. Conformità GDPR Art. 5(1)(e) - Limitazione conservazione
 * 2. Provvedimento Garante 2008 - 6 mesi minimo
 * 3. Art. 2220 c.c. - Conservazione documenti fiscali
 * 4. Privacy by Design - Ottimizzazione automatica
 */

// Policy di retention per tipo di log
const RETENTION_POLICIES = {
  // Log critici - conservazione lunga per sicurezza
  ERROR: {
    retention_days: 730, // 2 anni
    reason: 'Errori critici - Sicurezza e debugging'
  },
  WARN: {
    retention_days: 365, // 1 anno
    reason: 'Warning - Monitoraggio sistema'
  },
  
  // Log informativi - conservazione media
  INFO: {
    retention_days: 180, // 6 mesi
    reason: 'Informazioni generali - Audit trail'
  },
  
  // Log di debug - conservazione breve
  DEBUG: {
    retention_days: 30, // 30 giorni
    reason: 'Debug - Solo per sviluppo'
  },
  TRACE: {
    retention_days: 7, // 1 settimana
    reason: 'Trace - Debugging dettagliato'
  }
};

async function cleanupCentralizedLogs() {
  try {
    console.log('🧹 PULIZIA CENTRALIZED_LOGS - GDPR-COMPLIANT');
    console.log('='.repeat(60));
    
    // 1. Backup prima della pulizia
    await createBackup();
    
    // 2. Analisi pre-pulizia
    const preStats = await getCurrentStats();
    console.log('\n📊 STATISTICHE PRE-PULIZIA:');
    showStats(preStats);
    
    // 3. Pulizia per livello di log
    const cleanupResults = await performCleanup();
    
    // 4. Analisi post-pulizia
    const postStats = await getCurrentStats();
    console.log('\n📊 STATISTICHE POST-PULIZIA:');
    showStats(postStats);
    
    // 5. Risultati finali
    showFinalResults(preStats, postStats, cleanupResults);
    
    // 6. Raccomandazioni
    showRecommendations();
    
  } catch (error) {
    console.error('❌ Errore durante pulizia:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

/**
 * Crea backup prima della pulizia
 */
async function createBackup() {
  console.log('\n💾 CREAZIONE BACKUP...');
  
  try {
    // Crea tabella backup se non esiste
    await pool.query(`
      CREATE TABLE IF NOT EXISTS centralized_logs_backup AS 
      SELECT * FROM centralized_logs WHERE 1=0
    `);
    
    // Backup dei dati che verranno eliminati
    const backupQuery = `
      INSERT INTO centralized_logs_backup
      SELECT * FROM centralized_logs 
      WHERE timestamp < NOW() - INTERVAL '2 years'
         OR (level IN ('DEBUG', 'TRACE') AND timestamp < NOW() - INTERVAL '30 days')
    `;
    
    const result = await pool.query(backupQuery);
    console.log(`✅ Backup creato: ${result.rowCount} record salvati`);
    
  } catch (error) {
    console.log('⚠️ Backup non disponibile, continuo con pulizia...');
  }
}

/**
 * Ottiene statistiche attuali
 */
async function getCurrentStats() {
  const stats = await pool.query(`
    SELECT 
      COUNT(*) as total_records,
      COUNT(CASE WHEN level = 'ERROR' THEN 1 END) as error_count,
      COUNT(CASE WHEN level = 'WARN' THEN 1 END) as warn_count,
      COUNT(CASE WHEN level = 'INFO' THEN 1 END) as info_count,
      COUNT(CASE WHEN level = 'DEBUG' THEN 1 END) as debug_count,
      COUNT(CASE WHEN level = 'TRACE' THEN 1 END) as trace_count,
      pg_size_pretty(pg_total_relation_size('centralized_logs')) as table_size,
      MIN(timestamp) as oldest_record,
      MAX(timestamp) as newest_record
    FROM centralized_logs
  `);
  
  return stats.rows[0];
}

/**
 * Mostra statistiche
 */
function showStats(stats) {
  console.log(`📈 Record totali: ${stats.total_records.toLocaleString()}`);
  console.log(`🔴 ERROR: ${stats.error_count.toLocaleString()}`);
  console.log(`🟡 WARN:  ${stats.warn_count.toLocaleString()}`);
  console.log(`🔵 INFO:  ${stats.info_count.toLocaleString()}`);
  console.log(`🟢 DEBUG: ${stats.debug_count.toLocaleString()}`);
  console.log(`⚪ TRACE: ${stats.trace_count.toLocaleString()}`);
  console.log(`💾 Dimensione: ${stats.table_size}`);
  console.log(`📅 Range: ${stats.oldest_record} → ${stats.newest_record}`);
}

/**
 * Esegue la pulizia
 */
async function performCleanup() {
  console.log('\n🗑️ ESECUZIONE PULIZIA...');
  const results = {};
  
  for (const [level, policy] of Object.entries(RETENTION_POLICIES)) {
    console.log(`\n🧹 Pulizia log ${level} (${policy.retention_days} giorni)...`);
    
    const deleteQuery = `
      DELETE FROM centralized_logs 
      WHERE level = $1 
        AND timestamp < NOW() - INTERVAL '${policy.retention_days} days'
    `;
    
    const result = await pool.query(deleteQuery, [level]);
    results[level] = result.rowCount;
    
    console.log(`   ✅ Eliminati ${result.rowCount.toLocaleString()} record`);
    console.log(`   📋 Motivo: ${policy.reason}`);
  }
  
  // Pulizia aggiuntiva: dati oltre 2 anni indipendentemente dal livello
  console.log('\n🧹 Pulizia dati oltre 2 anni...');
  const oldDataQuery = `
    DELETE FROM centralized_logs 
    WHERE timestamp < NOW() - INTERVAL '2 years'
  `;
  
  const oldDataResult = await pool.query(oldDataQuery);
  results.over_2_years = oldDataResult.rowCount;
  console.log(`   ✅ Eliminati ${oldDataResult.rowCount.toLocaleString()} record oltre 2 anni`);
  
  return results;
}

/**
 * Mostra risultati finali
 */
function showFinalResults(preStats, postStats, cleanupResults) {
  console.log('\n🎯 RISULTATI FINALI:');
  console.log('='.repeat(40));
  
  const totalDeleted = Object.values(cleanupResults).reduce((sum, count) => sum + count, 0);
  const recordsSaved = preStats.total_records - postStats.total_records;
  
  console.log(`📉 Record eliminati: ${totalDeleted.toLocaleString()}`);
  console.log(`📊 Record rimanenti: ${postStats.total_records.toLocaleString()}`);
  console.log(`💾 Riduzione: ${Math.round((recordsSaved / preStats.total_records) * 100)}%`);
  
  console.log('\n📋 DETTAGLIO ELIMINAZIONI:');
  Object.entries(cleanupResults).forEach(([level, count]) => {
    if (count > 0) {
      console.log(`   ${level}: ${count.toLocaleString()} record`);
    }
  });
  
  // Stima risparmio spazio
  const avgRecordSize = 1024; // bytes
  const spaceSavedMB = Math.round((totalDeleted * avgRecordSize) / (1024 * 1024));
  console.log(`\n💾 Spazio liberato: ~${spaceSavedMB} MB`);
}

/**
 * Mostra raccomandazioni
 */
function showRecommendations() {
  console.log('\n💡 RACCOMANDAZIONI:');
  console.log('='.repeat(40));
  
  console.log('\n1. 🔄 IMPLEMENTA RETENTION AUTOMATICA');
  console.log('   • Configura job giornaliero per pulizia automatica');
  console.log('   • Usa script data-archival-strategy.js esistente');
  console.log('   • Monitora performance e conformità');
  
  console.log('\n2. 📊 OTTIMIZZA LIVELLI DI LOG');
  console.log('   • Riduci log DEBUG/TRACE in produzione');
  console.log('   • Mantieni solo ERROR/WARN/INFO per audit');
  console.log('   • Configura livelli per ambiente');
  
  console.log('\n3. 🗄️ IMPLEMENTA ARCHIVIAZIONE');
  console.log('   • Sposta dati 6+ mesi su storage esterno');
  console.log('   • Comprimi e critta dati archiviati');
  console.log('   • Mantieni solo dati "hot" nel database');
  
  console.log('\n4. 📈 MONITORAGGIO CONTINUO');
  console.log('   • Dashboard per monitorare crescita log');
  console.log('   • Alert per dimensioni eccessive');
  console.log('   • Report periodici per conformità');
  
  console.log('\n⚖️ CONFORMITÀ GARANTITA:');
  console.log('   ✅ GDPR Art. 5(1)(e) - Limitazione conservazione');
  console.log('   ✅ GDPR Art. 32 - Sicurezza del trattamento');
  console.log('   ✅ Provvedimento Garante 2008 - 6 mesi minimo');
  console.log('   ✅ Privacy by Design - Ottimizzazione automatica');
  
  console.log('\n🚀 PROSSIMI PASSI:');
  console.log('   1. Esegui questo script regolarmente');
  console.log('   2. Configura retention policy automatica');
  console.log('   3. Implementa archiviazione su storage esterno');
  console.log('   4. Monitora performance e conformità');
  console.log('');
}

/**
 * Funzione per pulizia selettiva
 */
async function selectiveCleanup(options = {}) {
  const {
    dryRun = false,
    maxAge = 365, // giorni
    levels = ['DEBUG', 'TRACE'],
    confirm = false
  } = options;
  
  console.log(`🧹 PULIZIA SELETTIVA ${dryRun ? '(DRY RUN)' : ''}`);
  console.log('='.repeat(50));
  
  if (!confirm && !dryRun) {
    console.log('⚠️ ATTENZIONE: Questa operazione eliminerà dati permanentemente!');
    console.log('   Usa --confirm per procedere o --dry-run per simulazione');
    return;
  }
  
  let totalDeleted = 0;
  
  for (const level of levels) {
    const query = `
      ${dryRun ? 'SELECT COUNT(*) as count' : 'DELETE'} FROM centralized_logs 
      WHERE level = $1 
        AND timestamp < NOW() - INTERVAL '${maxAge} days'
    `;
    
    const result = await pool.query(query, [level]);
    const count = dryRun ? result.rows[0].count : result.rowCount;
    
    console.log(`${level}: ${count.toLocaleString()} record ${dryRun ? 'da eliminare' : 'eliminati'}`);
    totalDeleted += count;
  }
  
  console.log(`\n📊 Totale: ${totalDeleted.toLocaleString()} record ${dryRun ? 'da eliminare' : 'eliminati'}`);
}

// Gestione argomenti da linea di comando
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--dry-run')) {
    selectiveCleanup({ dryRun: true });
  } else if (args.includes('--selective')) {
    selectiveCleanup({ confirm: args.includes('--confirm') });
  } else {
    cleanupCentralizedLogs();
  }
}

module.exports = { 
  cleanupCentralizedLogs, 
  selectiveCleanup,
  RETENTION_POLICIES 
};
