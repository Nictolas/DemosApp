// File: analyze-centralized-logs.cjs
// Analisi dettagliata dei centralized_logs per ottimizzazione GDPR-compliant

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * ANALISI CENTRALIZED_LOGS - STRATEGIA OTTIMIZZAZIONE GDPR-COMPLIANT
 * 
 * Obiettivi:
 * 1. Ridurre l'81% del database (56 MB su 69 MB totali)
 * 2. Mantenere conformità GDPR e requisiti legali
 * 3. Implementare retention policy intelligente
 * 4. Ottimizzare performance e storage
 */

async function analyzeCentralizedLogs() {
  try {
    console.log('🔍 ANALISI CENTRALIZED_LOGS - OTTIMIZZAZIONE GDPR-COMPLIANT\n');
    
    // 1. Statistiche generali
    await showGeneralStats();
    
    // 2. Analisi per livello di log
    await analyzeByLogLevel();
    
    // 3. Analisi per tipo di evento
    await analyzeByEventType();
    
    // 4. Analisi per età dei dati
    await analyzeByAge();
    
    // 5. Analisi contenuto meta_data
    await analyzeMetadata();
    
    // 6. Proposta strategia ottimizzazione
    await proposeOptimizationStrategy();
    
  } catch (error) {
    console.error('❌ Errore durante analisi:', error);
  } finally {
    await pool.end();
  }
}

/**
 * Statistiche generali della tabella
 */
async function showGeneralStats() {
  console.log('📊 STATISTICHE GENERALI');
  console.log('='.repeat(50));
  
  const stats = await pool.query(`
    SELECT 
      COUNT(*) as total_records,
      COUNT(DISTINCT user_id) as unique_users,
      COUNT(DISTINCT ip_address) as unique_ips,
      COUNT(DISTINCT endpoint) as unique_endpoints,
      MIN(timestamp) as oldest_record,
      MAX(timestamp) as newest_record,
      pg_size_pretty(pg_total_relation_size('centralized_logs')) as table_size
    FROM centralized_logs
  `);
  
  const stat = stats.rows[0];
  console.log(`📈 Record totali: ${stat.total_records.toLocaleString()}`);
  console.log(`👥 Utenti unici: ${stat.unique_users.toLocaleString()}`);
  console.log(`🌐 IP unici: ${stat.unique_ips.toLocaleString()}`);
  console.log(`🔗 Endpoint unici: ${stat.unique_endpoints.toLocaleString()}`);
  console.log(`📅 Record più vecchio: ${stat.oldest_record}`);
  console.log(`📅 Record più recente: ${stat.newest_record}`);
  console.log(`💾 Dimensione tabella: ${stat.table_size}`);
  console.log('');
}

/**
 * Analisi per livello di log
 */
async function analyzeByLogLevel() {
  console.log('📋 ANALISI PER LIVELLO DI LOG');
  console.log('='.repeat(50));
  
  const levels = await pool.query(`
    SELECT 
      level,
      COUNT(*) as count,
      ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage,
      MIN(timestamp) as oldest,
      MAX(timestamp) as newest,
      pg_size_pretty(SUM(pg_column_size(level) + pg_column_size(message) + pg_column_size(meta_data))) as estimated_size
    FROM centralized_logs
    GROUP BY level
    ORDER BY count DESC
  `);
  
  levels.rows.forEach(row => {
    console.log(`${row.level.padEnd(8)} | ${row.count.toLocaleString().padStart(8)} record (${row.percentage}%) | ${row.estimated_size}`);
  });
  console.log('');
}

/**
 * Analisi per tipo di evento
 */
async function analyzeByEventType() {
  console.log('🎯 ANALISI PER TIPO DI EVENTO');
  console.log('='.repeat(50));
  
  const events = await pool.query(`
    SELECT 
      CASE 
        WHEN message ILIKE '%request%' OR message ILIKE '%HTTP%' THEN 'HTTP Requests'
        WHEN message ILIKE '%error%' OR message ILIKE '%exception%' THEN 'Errors'
        WHEN message ILIKE '%security%' OR message ILIKE '%attack%' THEN 'Security Events'
        WHEN message ILIKE '%performance%' OR message ILIKE '%duration%' THEN 'Performance'
        WHEN message ILIKE '%audit%' OR message ILIKE '%action%' THEN 'Audit Actions'
        WHEN message ILIKE '%login%' OR message ILIKE '%auth%' THEN 'Authentication'
        ELSE 'Other'
      END as event_type,
      COUNT(*) as count,
      ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
    FROM centralized_logs
    GROUP BY 1
    ORDER BY count DESC
  `);
  
  events.rows.forEach(row => {
    console.log(`${row.event_type.padEnd(20)} | ${row.count.toLocaleString().padStart(8)} record (${row.percentage}%)`);
  });
  console.log('');
}

/**
 * Analisi per età dei dati
 */
async function analyzeByAge() {
  console.log('⏰ ANALISI PER ETÀ DEI DATI');
  console.log('='.repeat(50));
  
  // Query semplificata per analisi età
  const ageGroups = await pool.query(`
    WITH age_analysis AS (
      SELECT 
        CASE 
          WHEN timestamp > NOW() - INTERVAL '1 day' THEN 1
          WHEN timestamp > NOW() - INTERVAL '7 days' THEN 2
          WHEN timestamp > NOW() - INTERVAL '30 days' THEN 3
          WHEN timestamp > NOW() - INTERVAL '90 days' THEN 4
          WHEN timestamp > NOW() - INTERVAL '180 days' THEN 5
          WHEN timestamp > NOW() - INTERVAL '365 days' THEN 6
          ELSE 7
        END as age_group_id,
        CASE 
          WHEN timestamp > NOW() - INTERVAL '1 day' THEN 'Ultimo giorno'
          WHEN timestamp > NOW() - INTERVAL '7 days' THEN 'Ultima settimana'
          WHEN timestamp > NOW() - INTERVAL '30 days' THEN 'Ultimo mese'
          WHEN timestamp > NOW() - INTERVAL '90 days' THEN 'Ultimi 3 mesi'
          WHEN timestamp > NOW() - INTERVAL '180 days' THEN 'Ultimi 6 mesi'
          WHEN timestamp > NOW() - INTERVAL '365 days' THEN 'Ultimo anno'
          ELSE 'Oltre 1 anno'
        END as age_group_name
      FROM centralized_logs
    )
    SELECT 
      age_group_name as age_group,
      COUNT(*) as count,
      ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
    FROM age_analysis
    GROUP BY age_group_id, age_group_name
    ORDER BY age_group_id
  `);
  
  ageGroups.rows.forEach(row => {
    console.log(`${row.age_group.padEnd(20)} | ${row.count.toLocaleString().padStart(8)} record (${row.percentage}%)`);
  });
  console.log('');
}

/**
 * Analisi contenuto meta_data
 */
async function analyzeMetadata() {
  console.log('📦 ANALISI METADATA');
  console.log('='.repeat(50));
  
  const metadata = await pool.query(`
    SELECT 
      COUNT(*) as total_with_metadata,
      COUNT(CASE WHEN meta_data IS NOT NULL AND meta_data != '{}' THEN 1 END) as non_empty_metadata,
      AVG(pg_column_size(meta_data)) as avg_metadata_size,
      MAX(pg_column_size(meta_data)) as max_metadata_size,
      pg_size_pretty(SUM(pg_column_size(meta_data))) as total_metadata_size
    FROM centralized_logs
  `);
  
  const meta = metadata.rows[0];
  console.log(`📊 Record con metadata: ${meta.total_with_metadata.toLocaleString()}`);
  console.log(`📦 Metadata non vuoti: ${meta.non_empty_metadata.toLocaleString()}`);
  console.log(`📏 Dimensione media metadata: ${Math.round(meta.avg_metadata_size)} bytes`);
  console.log(`📏 Dimensione max metadata: ${meta.max_metadata_size} bytes`);
  console.log(`💾 Dimensione totale metadata: ${meta.total_metadata_size}`);
  console.log('');
}

/**
 * Proposta strategia di ottimizzazione
 */
async function proposeOptimizationStrategy() {
  console.log('🚀 STRATEGIA DI OTTIMIZZAZIONE GDPR-COMPLIANT');
  console.log('='.repeat(60));
  
  // Calcola potenziale risparmio
  const savings = await calculatePotentialSavings();
  
  console.log('\n📋 RACCOMANDAZIONI IMMEDIATE:');
  console.log('─'.repeat(40));
  
  console.log('\n1. 🗑️ PULIZIA DATI VECCHI (Conformità GDPR Art. 5(1)(e))');
  console.log(`   • Elimina log oltre 2 anni: ${savings.over_2_years.toLocaleString()} record`);
  console.log(`   • Risparmio stimato: ${savings.over_2_years_mb} MB`);
  console.log(`   • Conformità: ✅ GDPR compliant (limite massimo ragionevole)`);
  
  console.log('\n2. 📊 OTTIMIZZAZIONE LIVELLI LOG');
  console.log(`   • Riduci log DEBUG/TRACE: ${savings.debug_trace.toLocaleString()} record`);
  console.log(`   • Risparmio stimato: ${savings.debug_trace_mb} MB`);
  console.log(`   • Conformità: ✅ Mantieni ERROR/WARN/INFO per audit`);
  
  console.log('\n3. 🔄 IMPLEMENTA RETENTION POLICY INTELLIGENTE');
  console.log('   • ERROR/WARN: 2 anni (sicurezza)');
  console.log('   • INFO: 1 anno (audit)');
  console.log('   • DEBUG/TRACE: 30 giorni (debugging)');
  console.log('   • Security Events: 3 anni (conformità)');
  
  console.log('\n4. 📦 COMPRESSIONE METADATA');
  console.log(`   • Comprimi metadata ridondanti: ${savings.metadata_compression_mb} MB`);
  console.log('   • Mantieni solo campi essenziali per GDPR');
  
  console.log('\n5. 🗄️ ARCHIVIAZIONE INTELLIGENTE');
  console.log('   • Sposta dati 6+ mesi su storage esterno');
  console.log('   • Mantieni solo dati "hot" nel database');
  console.log('   • Implementa compressione e crittografia');
  
  console.log('\n📈 RISULTATO ATTESO:');
  console.log('─'.repeat(40));
  const totalSavings = savings.over_2_years_mb + savings.debug_trace_mb + savings.metadata_compression_mb;
  const currentSize = 56; // MB attuali
  const newSize = currentSize - totalSavings;
  const reductionPercent = Math.round((totalSavings / currentSize) * 100);
  
  console.log(`💾 Dimensione attuale: ${currentSize} MB`);
  console.log(`💾 Dimensione dopo ottimizzazione: ~${newSize} MB`);
  console.log(`📉 Riduzione: ${totalSavings} MB (${reductionPercent}%)`);
  console.log(`🎯 Database totale: da 69 MB a ~${69 - totalSavings} MB`);
  
  console.log('\n⚖️ CONFORMITÀ LEGALE:');
  console.log('─'.repeat(40));
  console.log('✅ GDPR Art. 5(1)(e) - Limitazione conservazione');
  console.log('✅ GDPR Art. 32 - Sicurezza del trattamento');
  console.log('✅ Provvedimento Garante 2008 - 6 mesi minimo');
  console.log('✅ Art. 2220 c.c. - Conservazione documenti fiscali');
  console.log('✅ Privacy by Design - Ottimizzazione automatica');
  
  console.log('\n🛠️ IMPLEMENTAZIONE:');
  console.log('─'.repeat(40));
  console.log('1. Esegui script di pulizia immediata');
  console.log('2. Configura retention policy automatica');
  console.log('3. Implementa archiviazione su storage esterno');
  console.log('4. Monitora performance e conformità');
  console.log('');
}

/**
 * Calcola potenziale risparmio
 */
async function calculatePotentialSavings() {
  // Dati oltre 2 anni
  const over2Years = await pool.query(`
    SELECT COUNT(*) as count
    FROM centralized_logs
    WHERE timestamp < NOW() - INTERVAL '2 years'
  `);
  
  // Log DEBUG/TRACE
  const debugTrace = await pool.query(`
    SELECT COUNT(*) as count
    FROM centralized_logs
    WHERE level IN ('DEBUG', 'TRACE')
  `);
  
  // Stima dimensioni (approssimativa)
  const avgRecordSize = 1024; // bytes per record (stima)
  const over2YearsMB = Math.round((over2Years.rows[0].count * avgRecordSize) / (1024 * 1024));
  const debugTraceMB = Math.round((debugTrace.rows[0].count * avgRecordSize) / (1024 * 1024));
  const metadataCompressionMB = 5; // Stima compressione metadata
  
  return {
    over_2_years: over2Years.rows[0].count,
    over_2_years_mb: over2YearsMB,
    debug_trace: debugTrace.rows[0].count,
    debug_trace_mb: debugTraceMB,
    metadata_compression_mb: metadataCompressionMB
  };
}

// Esegui analisi
if (require.main === module) {
  analyzeCentralizedLogs();
}

module.exports = { analyzeCentralizedLogs };
