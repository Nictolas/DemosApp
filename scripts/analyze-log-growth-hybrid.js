/**
 * Analisi crescita log e valutazione soluzione ibrida
 * Cloud automatico + Hard Disk manuale ogni 5GB
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false
});

// Configurazione soluzione ibrida
const HYBRID_CONFIG = {
  // Cloud storage gratuito disponibile
  cloudFreeGB: 10, // Backblaze B2 (10GB gratis permanente)
  
  // Soglia per export manuale su hard disk
  hardDiskThresholdGB: 5,
  
  // Compressione GZIP (riduzione ~70%)
  compressionRatio: 0.3,
  
  // Costi cloud dopo tier gratuito
  cloudCosts: {
    b2: 0.005, // $0.005/GB/mese (Backblaze B2)
    s3: 0.023, // $0.023/GB/mese (AWS S3 eu-west-1)
    gcs: 0.020, // $0.020/GB/mese (Google Cloud)
    azure: 0.018 // $0.018/GB/mese (Azure)
  }
};

/**
 * Analizza crescita attuale dei log
 */
async function analyzeLogGrowth() {
  console.log('📊 ANALISI CRESCITA LOG...\n');
  
  const stats = {};
  
  // Analizza centralized_logs
  try {
    const centralizedStats = await pool.query(`
      SELECT 
        COUNT(*) as total_records,
        pg_size_pretty(pg_total_relation_size('centralized_logs')) as table_size,
        pg_total_relation_size('centralized_logs') as size_bytes,
        MIN(created_at) as oldest_record,
        MAX(created_at) as newest_record,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 day') as records_last_day,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as records_last_week,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') as records_last_month
      FROM centralized_logs
    `);
    
    if (centralizedStats.rows[0].total_records > 0) {
      stats.centralized_logs = {
        totalRecords: parseInt(centralizedStats.rows[0].total_records),
        sizeBytes: parseInt(centralizedStats.rows[0].size_bytes),
        sizeMB: parseFloat((centralizedStats.rows[0].size_bytes / 1024 / 1024).toFixed(2)),
        recordsLastDay: parseInt(centralizedStats.rows[0].records_last_day),
        recordsLastWeek: parseInt(centralizedStats.rows[0].records_last_week),
        recordsLastMonth: parseInt(centralizedStats.rows[0].records_last_month),
        oldestRecord: centralizedStats.rows[0].oldest_record,
        newestRecord: centralizedStats.rows[0].newest_record
      };
    }
  } catch (error) {
    console.log('⚠️ Tabella centralized_logs non trovata');
  }
  
  // Analizza audit_logs
  try {
    const auditStats = await pool.query(`
      SELECT 
        COUNT(*) as total_records,
        pg_size_pretty(pg_total_relation_size('audit_logs_compressed')) as table_size,
        pg_total_relation_size('audit_logs_compressed') as size_bytes,
        MIN(created_at) as oldest_record,
        MAX(created_at) as newest_record,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 day') as records_last_day,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as records_last_week,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') as records_last_month
      FROM audit_logs_compressed
    `);
    
    if (auditStats.rows[0].total_records > 0) {
      stats.audit_logs = {
        totalRecords: parseInt(auditStats.rows[0].total_records),
        sizeBytes: parseInt(auditStats.rows[0].size_bytes),
        sizeMB: parseFloat((auditStats.rows[0].size_bytes / 1024 / 1024).toFixed(2)),
        recordsLastDay: parseInt(auditStats.rows[0].records_last_day),
        recordsLastWeek: parseInt(auditStats.rows[0].records_last_week),
        recordsLastMonth: parseInt(auditStats.rows[0].records_last_month),
        oldestRecord: auditStats.rows[0].oldest_record,
        newestRecord: auditStats.rows[0].newest_record
      };
    }
  } catch (error) {
    // Prova tabella non compressa
    try {
      const auditStats = await pool.query(`
        SELECT 
          COUNT(*) as total_records,
          pg_size_pretty(pg_total_relation_size('audit_logs')) as table_size,
          pg_total_relation_size('audit_logs') as size_bytes,
          MIN(created_at) as oldest_record,
          MAX(created_at) as newest_record,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 day') as records_last_day,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as records_last_week,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') as records_last_month
        FROM audit_logs
      `);
      
      if (auditStats.rows[0].total_records > 0) {
        stats.audit_logs = {
          totalRecords: parseInt(auditStats.rows[0].total_records),
          sizeBytes: parseInt(auditStats.rows[0].size_bytes),
          sizeMB: parseFloat((auditStats.rows[0].size_bytes / 1024 / 1024).toFixed(2)),
          recordsLastDay: parseInt(auditStats.rows[0].records_last_day),
          recordsLastWeek: parseInt(auditStats.rows[0].records_last_week),
          recordsLastMonth: parseInt(auditStats.rows[0].records_last_month),
          oldestRecord: auditStats.rows[0].oldest_record,
          newestRecord: auditStats.rows[0].newest_record
        };
      }
    } catch (e) {
      console.log('⚠️ Tabella audit_logs non trovata');
    }
  }
  
  return stats;
}

/**
 * Calcola proiezioni di crescita
 */
function calculateGrowthProjections(stats) {
  const projections = {};
  
  // Calcola crescita giornaliera
  const totalRecordsLastDay = (stats.centralized_logs?.recordsLastDay || 0) + 
                               (stats.audit_logs?.recordsLastDay || 0);
  const totalSizeMB = (stats.centralized_logs?.sizeMB || 0) + 
                      (stats.audit_logs?.sizeMB || 0);
  const totalRecords = (stats.centralized_logs?.totalRecords || 0) + 
                       (stats.audit_logs?.totalRecords || 0);
  
  // Dimensione media per record (in MB)
  const avgRecordSizeMB = totalRecords > 0 ? totalSizeMB / totalRecords : 0;
  
  // Crescita giornaliera (MB/giorno)
  const dailyGrowthMB = totalRecordsLastDay * avgRecordSizeMB;
  
  // Crescita settimanale (MB/settimana)
  const weeklyGrowthMB = dailyGrowthMB * 7;
  
  // Crescita mensile (MB/mese)
  const monthlyGrowthMB = dailyGrowthMB * 30;
  
  // Calcola quando raggiungeremo 5GB (dopo compressione)
  const targetGB = HYBRID_CONFIG.hardDiskThresholdGB;
  const targetMB = targetGB * 1024;
  const compressedTargetMB = targetMB * HYBRID_CONFIG.compressionRatio; // Dopo compressione
  
  // Tempo per raggiungere soglia (in giorni)
  const daysToReachThreshold = dailyGrowthMB > 0 ? 
    Math.ceil(compressedTargetMB / dailyGrowthMB) : null;
  
  // Tempo per raggiungere 10GB cloud (in giorni)
  const cloudLimitGB = HYBRID_CONFIG.cloudFreeGB;
  const cloudLimitMB = cloudLimitGB * 1024;
  const compressedCloudLimitMB = cloudLimitMB * HYBRID_CONFIG.compressionRatio;
  const daysToReachCloudLimit = dailyGrowthMB > 0 ? 
    Math.ceil(compressedCloudLimitMB / dailyGrowthMB) : null;
  
  return {
    dailyGrowthMB,
    weeklyGrowthMB,
    monthlyGrowthMB,
    avgRecordSizeMB,
    daysToReachThreshold,
    daysToReachCloudLimit,
    compressedDailyGrowthMB: dailyGrowthMB * HYBRID_CONFIG.compressionRatio,
    compressedMonthlyGrowthMB: monthlyGrowthMB * HYBRID_CONFIG.compressionRatio
  };
}

/**
 * Valuta soluzione ibrida
 */
function evaluateHybridSolution(projections) {
  const evaluations = [];
  
  // Scenario 1: Backblaze B2 (10GB gratis)
  const b2FreeGB = 10;
  const b2FreeMB = b2FreeGB * 1024;
  const compressedB2FreeMB = b2FreeMB * HYBRID_CONFIG.compressionRatio;
  
  const daysInB2Free = projections.dailyGrowthMB > 0 ? 
    Math.ceil(compressedB2FreeMB / projections.compressedDailyGrowthMB) : null;
  
  // Dopo tier gratuito, costo mensile
  const b2MonthlyCost = projections.compressedMonthlyGrowthMB > compressedB2FreeMB ? 
    ((projections.compressedMonthlyGrowthMB - compressedB2FreeMB) / 1024) * HYBRID_CONFIG.cloudCosts.b2 : 0;
  
  evaluations.push({
    provider: 'Backblaze B2',
    freeGB: b2FreeGB,
    daysFree: daysInB2Free,
    monthlyCostAfterFree: b2MonthlyCost,
    recommendation: daysInB2Free > 365 ? '✅ Eccellente' : daysInB2Free > 180 ? '✅ Buono' : '⚠️ Considera upgrade'
  });
  
  // Scenario 2: AWS S3 (5GB gratis per 12 mesi)
  const s3FreeGB = 5;
  const s3FreeMB = s3FreeGB * 1024;
  const compressedS3FreeMB = s3FreeMB * HYBRID_CONFIG.compressionRatio;
  
  const daysInS3Free = projections.dailyGrowthMB > 0 ? 
    Math.ceil(compressedS3FreeMB / projections.compressedDailyGrowthMB) : null;
  
  const s3MonthlyCost = projections.compressedMonthlyGrowthMB > compressedS3FreeMB ? 
    ((projections.compressedMonthlyGrowthMB - compressedS3FreeMB) / 1024) * HYBRID_CONFIG.cloudCosts.s3 : 0;
  
  evaluations.push({
    provider: 'AWS S3',
    freeGB: s3FreeGB,
    daysFree: daysInS3Free,
    monthlyCostAfterFree: s3MonthlyCost,
    note: 'Solo 12 mesi gratis',
    recommendation: daysInS3Free > 365 ? '✅ Buono per primo anno' : '⚠️ Considera alternativa'
  });
  
  return evaluations;
}

/**
 * Calcola frequenza export su hard disk
 */
function calculateHardDiskExportFrequency(projections) {
  const thresholdMB = HYBRID_CONFIG.hardDiskThresholdGB * 1024;
  const compressedThresholdMB = thresholdMB * HYBRID_CONFIG.compressionRatio;
  
  if (!projections.daysToReachThreshold) {
    return null;
  }
  
  const days = projections.daysToReachThreshold;
  const weeks = Math.ceil(days / 7);
  const months = Math.ceil(days / 30);
  
  return {
    days,
    weeks,
    months,
    frequency: days < 30 ? `Ogni ${days} giorni` : 
                days < 90 ? `Ogni ${weeks} settimane` : 
                `Ogni ${months} mesi`
  };
}

/**
 * Stampa report completo
 */
function printReport(stats, projections, evaluations, hardDiskFrequency) {
  console.log('='.repeat(70));
  console.log('📊 REPORT ANALISI CRESCITA LOG E SOLUZIONE IBRIDA');
  console.log('='.repeat(70));
  
  console.log('\n📈 SITUAZIONE ATTUALE:');
  console.log('─'.repeat(50));
  
  if (stats.centralized_logs) {
    console.log(`\n📋 centralized_logs:`);
    console.log(`   Record totali: ${stats.centralized_logs.totalRecords.toLocaleString()}`);
    console.log(`   Dimensione: ${stats.centralized_logs.sizeMB.toFixed(2)} MB`);
    console.log(`   Record ultimo giorno: ${stats.centralized_logs.recordsLastDay.toLocaleString()}`);
    console.log(`   Record ultimo mese: ${stats.centralized_logs.recordsLastMonth.toLocaleString()}`);
  }
  
  if (stats.audit_logs) {
    console.log(`\n📋 audit_logs:`);
    console.log(`   Record totali: ${stats.audit_logs.totalRecords.toLocaleString()}`);
    console.log(`   Dimensione: ${stats.audit_logs.sizeMB.toFixed(2)} MB`);
    console.log(`   Record ultimo giorno: ${stats.audit_logs.recordsLastDay.toLocaleString()}`);
    console.log(`   Record ultimo mese: ${stats.audit_logs.recordsLastMonth.toLocaleString()}`);
  }
  
  const totalSizeMB = (stats.centralized_logs?.sizeMB || 0) + (stats.audit_logs?.sizeMB || 0);
  console.log(`\n💾 DIMENSIONE TOTALE LOG: ${totalSizeMB.toFixed(2)} MB`);
  
  console.log('\n📈 PROIEZIONI CRESCITA:');
  console.log('─'.repeat(50));
  console.log(`   Crescita giornaliera: ${projections.dailyGrowthMB.toFixed(2)} MB/giorno`);
  console.log(`   Crescita settimanale: ${projections.weeklyGrowthMB.toFixed(2)} MB/settimana`);
  console.log(`   Crescita mensile: ${projections.monthlyGrowthMB.toFixed(2)} MB/mese`);
  console.log(`   Dimensione media record: ${(projections.avgRecordSizeMB * 1024).toFixed(2)} KB`);
  console.log(`\n   📦 DOPO COMPRESSIONE GZIP (70% riduzione):`);
  console.log(`   Crescita giornaliera: ${projections.compressedDailyGrowthMB.toFixed(2)} MB/giorno`);
  console.log(`   Crescita mensile: ${projections.compressedMonthlyGrowthMB.toFixed(2)} MB/mese`);
  
  console.log('\n⏱️ TEMPO PER RAGGIUNGERE SOGLIE:');
  console.log('─'.repeat(50));
  if (projections.daysToReachThreshold) {
    const days = projections.daysToReachThreshold;
    const weeks = Math.ceil(days / 7);
    const months = Math.ceil(days / 30);
    console.log(`   📦 5GB (soglia export hard disk): ${days} giorni (${weeks} settimane, ~${months} mesi)`);
  }
  
  if (projections.daysToReachCloudLimit) {
    const days = projections.daysToReachCloudLimit;
    const weeks = Math.ceil(days / 7);
    const months = Math.ceil(days / 30);
    console.log(`   ☁️ 10GB (limite cloud gratis): ${days} giorni (${weeks} settimane, ~${months} mesi)`);
  }
  
  console.log('\n💾 FREQUENZA EXPORT SU HARD DISK:');
  console.log('─'.repeat(50));
  if (hardDiskFrequency) {
    console.log(`   ⏰ Frequenza: ${hardDiskFrequency.frequency}`);
    console.log(`   📅 Dettagli: ${hardDiskFrequency.days} giorni (${hardDiskFrequency.weeks} settimane, ~${hardDiskFrequency.months} mesi)`);
  }
  
  console.log('\n☁️ VALUTAZIONE CLOUD STORAGE:');
  console.log('─'.repeat(50));
  evaluations.forEach(eval => {
    console.log(`\n   ${eval.provider}:`);
    console.log(`   ✅ Tier gratuito: ${eval.freeGB} GB`);
    if (eval.daysFree) {
      const months = Math.ceil(eval.daysFree / 30);
      console.log(`   ⏱️ Durata tier gratuito: ~${months} mesi (${eval.daysFree} giorni)`);
    }
    if (eval.monthlyCostAfterFree > 0) {
      console.log(`   💰 Costo dopo tier gratis: ~$${eval.monthlyCostAfterFree.toFixed(2)}/mese`);
    }
    console.log(`   📊 ${eval.recommendation}`);
    if (eval.note) {
      console.log(`   ℹ️  ${eval.note}`);
    }
  });
  
  console.log('\n💰 COSTO STIMATO SOLUZIONE IBRIDA:');
  console.log('─'.repeat(50));
  console.log(`   ☁️ Cloud storage (Backblaze B2): Gratis per ~${evaluations[0].daysFree ? Math.ceil(evaluations[0].daysFree / 30) : '?'} mesi`);
  console.log(`   💾 Hard disk esterno: €50-100 (una tantum)`);
  console.log(`   📦 Export manuale: ~${hardDiskFrequency?.weeks || '?'} settimane`);
  console.log(`   💰 Costo mensile medio: ~$${evaluations[0].monthlyCostAfterFree.toFixed(2)}/mese (dopo tier gratis)`);
  
  console.log('\n✅ RACCOMANDAZIONE:');
  console.log('─'.repeat(50));
  const bestOption = evaluations.reduce((best, current) => 
    (current.daysFree || 0) > (best.daysFree || 0) ? current : best
  );
  
  console.log(`   🎯 Soluzione Ibrida: ${bestOption.provider} + Hard Disk`);
  console.log(`   📅 Backup cloud automatico ogni giorno`);
  console.log(`   💾 Export manuale su hard disk ogni ${hardDiskFrequency?.weeks || '?'} settimane (quando raggiungi 5GB)`);
  console.log(`   💰 Costo totale: ~$${bestOption.monthlyCostAfterFree.toFixed(2)}/mese dopo tier gratis`);
  
  console.log('\n' + '='.repeat(70));
}

/**
 * Funzione principale
 */
async function main() {
  try {
    const stats = await analyzeLogGrowth();
    const projections = calculateGrowthProjections(stats);
    const evaluations = evaluateHybridSolution(projections);
    const hardDiskFrequency = calculateHardDiskExportFrequency(projections);
    
    printReport(stats, projections, evaluations, hardDiskFrequency);
    
  } catch (error) {
    console.error('❌ Errore:', error);
  } finally {
    await pool.end();
  }
}

// Esegui se chiamato direttamente
if (require.main === module) {
  main();
}

module.exports = {
  analyzeLogGrowth,
  calculateGrowthProjections,
  evaluateHybridSolution,
  calculateHardDiskExportFrequency
};

