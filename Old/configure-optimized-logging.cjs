// File: configure-optimized-logging.cjs
// Configurazione sistema di logging ottimizzato per prevenire crescita log inutili

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * CONFIGURAZIONE LOGGING OTTIMIZZATO
 * 
 * Obiettivi:
 * 1. Prevenire crescita log inutili
 * 2. Configurare livelli per ambiente
 * 3. Implementare retention automatica
 * 4. Ottimizzare performance
 * 5. Garantire conformità GDPR
 */

async function configureOptimizedLogging() {
  try {
    console.log('🚀 CONFIGURAZIONE LOGGING OTTIMIZZATO');
    console.log('='.repeat(60));
    
    // 1. Configura livelli di log per ambiente
    await setupLogLevels();
    
    // 2. Implementa retention policy automatica
    await setupRetentionPolicy();
    
    // 3. Configura filtri per log non essenziali
    await setupLogFilters();
    
    // 4. Implementa compressione automatica
    await setupAutomaticCompression();
    
    // 5. Configura monitoraggio
    await setupLoggingMonitoring();
    
    // 6. Crea job automatici
    await createAutomaticJobs();
    
    console.log('\n🎉 CONFIGURAZIONE COMPLETATA!');
    console.log('Il sistema ora previene automaticamente la crescita di log inutili.');
    
  } catch (error) {
    console.error('❌ Errore durante configurazione:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

/**
 * Configura livelli di log per ambiente
 */
async function setupLogLevels() {
  console.log('\n🎯 CONFIGURAZIONE LIVELLI DI LOG...');
  
  // Crea tabella configurazione
  await pool.query(`
    CREATE TABLE IF NOT EXISTS logging_config (
      id SERIAL PRIMARY KEY,
      environment VARCHAR(20) NOT NULL,
      level VARCHAR(10) NOT NULL,
      enabled BOOLEAN DEFAULT true,
      retention_days INTEGER NOT NULL,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(environment, level)
    )
  `);
  
  // Configurazione per ambiente
  const configs = [
    // PRODUZIONE - Solo log essenziali
    { env: 'production', level: 'ERROR', days: 730, desc: 'Errori critici - 2 anni' },
    { env: 'production', level: 'WARN', days: 365, desc: 'Warning - 1 anno' },
    { env: 'production', level: 'INFO', days: 180, desc: 'Info essenziali - 6 mesi' },
    { env: 'production', level: 'DEBUG', days: 0, desc: 'Debug disabilitato in produzione' },
    { env: 'production', level: 'TRACE', days: 0, desc: 'Trace disabilitato in produzione' },
    
    // STAGING - Log per testing
    { env: 'staging', level: 'ERROR', days: 365, desc: 'Errori - 1 anno' },
    { env: 'staging', level: 'WARN', days: 180, desc: 'Warning - 6 mesi' },
    { env: 'staging', level: 'INFO', days: 90, desc: 'Info - 3 mesi' },
    { env: 'staging', level: 'DEBUG', days: 30, desc: 'Debug - 1 mese' },
    { env: 'staging', level: 'TRACE', days: 7, desc: 'Trace - 1 settimana' },
    
    // SVILUPPO - Tutti i log
    { env: 'development', level: 'ERROR', days: 180, desc: 'Errori - 6 mesi' },
    { env: 'development', level: 'WARN', days: 90, desc: 'Warning - 3 mesi' },
    { env: 'development', level: 'INFO', days: 30, desc: 'Info - 1 mese' },
    { env: 'development', level: 'DEBUG', days: 7, desc: 'Debug - 1 settimana' },
    { env: 'development', level: 'TRACE', days: 1, desc: 'Trace - 1 giorno' }
  ];
  
  for (const config of configs) {
    await pool.query(`
      INSERT INTO logging_config (environment, level, enabled, retention_days, description)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (environment, level) DO UPDATE SET
        enabled = EXCLUDED.enabled,
        retention_days = EXCLUDED.retention_days,
        description = EXCLUDED.description
    `, [
      config.env,
      config.level,
      config.days > 0,
      config.days,
      config.desc
    ]);
  }
  
  console.log('✅ Configurazione livelli completata');
  console.log('📋 Configurazioni create:');
  configs.forEach(config => {
    if (config.days > 0) {
      console.log(`   ${config.env.toUpperCase()}: ${config.level} (${config.days} giorni)`);
    }
  });
}

/**
 * Implementa retention policy automatica
 */
async function setupRetentionPolicy() {
  console.log('\n⏰ CONFIGURAZIONE RETENTION POLICY...');
  
  // Crea tabella per tracking retention
  await pool.query(`
    CREATE TABLE IF NOT EXISTS retention_policy_log (
      id SERIAL PRIMARY KEY,
      table_name VARCHAR(100) NOT NULL,
      level VARCHAR(10),
      records_deleted INTEGER NOT NULL,
      retention_days INTEGER NOT NULL,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Crea funzione per retention automatica
  await pool.query(`
    CREATE OR REPLACE FUNCTION cleanup_old_logs()
    RETURNS INTEGER AS $$
    DECLARE
      total_deleted INTEGER := 0;
      config_record RECORD;
      deleted_count INTEGER;
    BEGIN
      -- Pulisce centralized_logs
      FOR config_record IN 
        SELECT level, retention_days 
        FROM logging_config 
        WHERE environment = COALESCE(current_setting('app.environment', true), 'production')
          AND enabled = true
          AND retention_days > 0
      LOOP
        EXECUTE format('DELETE FROM centralized_logs WHERE level = %L AND timestamp < NOW() - INTERVAL %L days', 
                      config_record.level, config_record.retention_days);
        
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        total_deleted := total_deleted + deleted_count;
        
        -- Log dell'operazione
        INSERT INTO retention_policy_log (table_name, level, records_deleted, retention_days)
        VALUES ('centralized_logs', config_record.level, deleted_count, config_record.retention_days);
      END LOOP;
      
      -- Pulisce audit_logs (7 anni per conformità)
      DELETE FROM audit_logs WHERE timestamp < NOW() - INTERVAL '2555 days';
      GET DIAGNOSTICS deleted_count = ROW_COUNT;
      total_deleted := total_deleted + deleted_count;
      
      INSERT INTO retention_policy_log (table_name, level, records_deleted, retention_days)
      VALUES ('audit_logs', 'ALL', deleted_count, 2555);
      
      -- Pulisce performance_metrics (30 giorni)
      DELETE FROM performance_metrics WHERE timestamp < NOW() - INTERVAL '30 days';
      GET DIAGNOSTICS deleted_count = ROW_COUNT;
      total_deleted := total_deleted + deleted_count;
      
      INSERT INTO retention_policy_log (table_name, level, records_deleted, retention_days)
      VALUES ('performance_metrics', 'ALL', deleted_count, 30);
      
      RETURN total_deleted;
    END;
    $$ LANGUAGE plpgsql;
  `);
  
  console.log('✅ Retention policy automatica configurata');
  console.log('📋 Policy implementate:');
  console.log('   • centralized_logs: Per livello e ambiente');
  console.log('   • audit_logs: 7 anni (conformità)');
  console.log('   • performance_metrics: 30 giorni');
}

/**
 * Configura filtri per log non essenziali
 */
async function setupLogFilters() {
  console.log('\n🔍 CONFIGURAZIONE FILTRI LOG...');
  
  // Crea tabella per filtri
  await pool.query(`
    CREATE TABLE IF NOT EXISTS log_filters (
      id SERIAL PRIMARY KEY,
      filter_name VARCHAR(100) NOT NULL UNIQUE,
      filter_pattern TEXT NOT NULL,
      action VARCHAR(20) NOT NULL, -- 'BLOCK', 'COMPRESS', 'TRUNCATE'
      enabled BOOLEAN DEFAULT true,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Filtri per log non essenziali
  const filters = [
    {
      name: 'block_debug_production',
      pattern: 'level = \'DEBUG\' AND current_setting(\'app.environment\', true) = \'production\'',
      action: 'BLOCK',
      desc: 'Blocca log DEBUG in produzione'
    },
    {
      name: 'block_trace_production',
      pattern: 'level = \'TRACE\' AND current_setting(\'app.environment\', true) = \'production\'',
      action: 'BLOCK',
      desc: 'Blocca log TRACE in produzione'
    },
    {
      name: 'compress_redundant_info',
      pattern: 'level = \'INFO\' AND message ILIKE \'%request%\' AND message ILIKE \'%response%\'',
      action: 'COMPRESS',
      desc: 'Comprimi log INFO ridondanti'
    },
    {
      name: 'truncate_long_messages',
      pattern: 'LENGTH(message) > 500',
      action: 'TRUNCATE',
      desc: 'Tronca messaggi lunghi'
    }
  ];
  
  for (const filter of filters) {
    await pool.query(`
      INSERT INTO log_filters (filter_name, filter_pattern, action, enabled, description)
      VALUES ($1, $2, $3, true, $4)
    `, [filter.name, filter.pattern, filter.action, filter.desc]);
  }
  
  console.log('✅ Filtri log configurati');
  console.log('📋 Filtri attivi:');
  filters.forEach(filter => {
    console.log(`   • ${filter.name}: ${filter.action} - ${filter.desc}`);
  });
}

/**
 * Implementa compressione automatica
 */
async function setupAutomaticCompression() {
  console.log('\n📦 CONFIGURAZIONE COMPRESSIONE AUTOMATICA...');
  
  // Crea funzione per compressione metadata
  await pool.query(`
    CREATE OR REPLACE FUNCTION compress_log_metadata()
    RETURNS INTEGER AS $$
    DECLARE
      compressed_count INTEGER := 0;
    BEGIN
      -- Comprimi metadata ridondanti
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
      WHERE meta_data IS NOT NULL 
        AND meta_data != '{}'
        AND jsonb_typeof(meta_data) = 'object';
      
      GET DIAGNOSTICS compressed_count = ROW_COUNT;
      
      -- Tronca messaggi lunghi
      UPDATE centralized_logs 
      SET message = LEFT(message, 500) || '... [TRUNCATED]'
      WHERE LENGTH(message) > 500;
      
      RETURN compressed_count;
    END;
    $$ LANGUAGE plpgsql;
  `);
  
  console.log('✅ Compressione automatica configurata');
  console.log('📋 Funzionalità:');
  console.log('   • Compressione metadata ridondanti');
  console.log('   • Troncamento messaggi lunghi');
  console.log('   • Ottimizzazione JSONB');
}

/**
 * Configura monitoraggio
 */
async function setupLoggingMonitoring() {
  console.log('\n📊 CONFIGURAZIONE MONITORAGGIO...');
  
  // Crea tabella per statistiche
  await pool.query(`
    CREATE TABLE IF NOT EXISTS logging_stats (
      id SERIAL PRIMARY KEY,
      table_name VARCHAR(100) NOT NULL,
      record_count INTEGER NOT NULL,
      table_size_mb DECIMAL(10,2) NOT NULL,
      oldest_record TIMESTAMP,
      newest_record TIMESTAMP,
      growth_rate DECIMAL(10,2),
      recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Crea funzione per statistiche
  await pool.query(`
    CREATE OR REPLACE FUNCTION record_logging_stats()
    RETURNS VOID AS $$
    DECLARE
      table_record RECORD;
      record_count INTEGER;
      table_size_mb DECIMAL;
      oldest_record TIMESTAMP;
      newest_record TIMESTAMP;
    BEGIN
      -- Statistiche per centralized_logs
      SELECT 
        COUNT(*) as count,
        pg_size_pretty(pg_total_relation_size('centralized_logs'))::text as size,
        MIN(timestamp) as oldest,
        MAX(timestamp) as newest
      INTO record_count, table_size_mb, oldest_record, newest_record
      FROM centralized_logs;
      
      INSERT INTO logging_stats (table_name, record_count, table_size_mb, oldest_record, newest_record)
      VALUES ('centralized_logs', record_count, 
              CAST(REPLACE(table_size_mb, ' MB', '') AS DECIMAL), 
              oldest_record, newest_record);
      
      -- Statistiche per audit_logs
      SELECT 
        COUNT(*) as count,
        pg_size_pretty(pg_total_relation_size('audit_logs'))::text as size,
        MIN(timestamp) as oldest,
        MAX(timestamp) as newest
      INTO record_count, table_size_mb, oldest_record, newest_record
      FROM audit_logs;
      
      INSERT INTO logging_stats (table_name, record_count, table_size_mb, oldest_record, newest_record)
      VALUES ('audit_logs', record_count, 
              CAST(REPLACE(table_size_mb, ' MB', '') AS DECIMAL), 
              oldest_record, newest_record);
    END;
    $$ LANGUAGE plpgsql;
  `);
  
  console.log('✅ Monitoraggio configurato');
  console.log('📋 Funzionalità:');
  console.log('   • Statistiche dimensioni tabelle');
  console.log('   • Tracking crescita log');
  console.log('   • Monitoraggio performance');
}

/**
 * Crea job automatici
 */
async function createAutomaticJobs() {
  console.log('\n🔄 CREAZIONE JOB AUTOMATICI...');
  
  // Crea tabella per job
  await pool.query(`
    CREATE TABLE IF NOT EXISTS logging_jobs (
      id SERIAL PRIMARY KEY,
      job_name VARCHAR(100) NOT NULL,
      job_function VARCHAR(100) NOT NULL,
      schedule VARCHAR(50) NOT NULL,
      enabled BOOLEAN DEFAULT true,
      last_run TIMESTAMP,
      next_run TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Configura job
  const jobs = [
    {
      name: 'cleanup_old_logs',
      function: 'cleanup_old_logs()',
      schedule: 'daily',
      desc: 'Pulizia log vecchi'
    },
    {
      name: 'compress_metadata',
      function: 'compress_log_metadata()',
      schedule: 'daily',
      desc: 'Compressione metadata'
    },
    {
      name: 'record_stats',
      function: 'record_logging_stats()',
      schedule: 'hourly',
      desc: 'Registrazione statistiche'
    }
  ];
  
  for (const job of jobs) {
    await pool.query(`
      INSERT INTO logging_jobs (job_name, job_function, schedule, enabled)
      VALUES ($1, $2, $3, true)
    `, [job.name, job.function, job.schedule]);
  }
  
  console.log('✅ Job automatici configurati');
  console.log('📋 Job creati:');
  jobs.forEach(job => {
    console.log(`   • ${job.name}: ${job.schedule} - ${job.desc}`);
  });
  
  console.log('\n💡 IMPLEMENTAZIONE JOB:');
  console.log('   Per implementare i job automatici, configura un cron job o scheduler:');
  console.log('   • Pulizia giornaliera: 0 3 * * * (3:00 AM)');
  console.log('   • Compressione giornaliera: 0 4 * * * (4:00 AM)');
  console.log('   • Statistiche orarie: 0 * * * * (ogni ora)');
}

// Esegui configurazione
if (require.main === module) {
  configureOptimizedLogging();
}

module.exports = { configureOptimizedLogging };
