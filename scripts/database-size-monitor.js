const { Pool } = require('pg');
require('dotenv').config();

// Configurazione database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * MONITORAGGIO DIMENSIONI DATABASE
 * 
 * Questo script monitora le dimensioni del database Neon e delle singole tabelle
 * per identificare quando è necessario eseguire l'archiviazione.
 */

// Soglie di allerta per dimensioni database
const SIZE_THRESHOLDS = {
  // Soglie per database totale (in MB)
  database: {
    warning: 500,    // 500 MB - avviso
    critical: 1000,  // 1 GB - critico
    max: 2000        // 2 GB - massimo prima di archiviazione forzata
  },
  
  // Soglie per tabelle individuali (in MB)
  tables: {
    warning: 50,     // 50 MB - avviso
    critical: 100,   // 100 MB - critico
    max: 200         // 200 MB - massimo
  }
};

/**
 * Ottiene le dimensioni del database
 */
async function getDatabaseSize() {
  const query = `
    SELECT 
      pg_size_pretty(pg_database_size(current_database())) as size_pretty,
      pg_database_size(current_database()) as size_bytes
  `;
  
  const result = await pool.query(query);
  return {
    sizePretty: result.rows[0].size_pretty,
    sizeBytes: parseInt(result.rows[0].size_bytes),
    sizeMB: Math.round(parseInt(result.rows[0].size_bytes) / 1024 / 1024)
  };
}

/**
 * Ottiene le dimensioni di tutte le tabelle
 */
async function getTableSizes() {
  const query = `
    SELECT 
      schemaname,
      tablename,
      pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size_pretty,
      pg_total_relation_size(schemaname||'.'||tablename) as size_bytes,
      pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size_pretty,
      pg_relation_size(schemaname||'.'||tablename) as table_size_bytes,
      pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as index_size_pretty,
      (pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as index_size_bytes
    FROM pg_tables 
    WHERE schemaname = 'public'
    ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
  `;
  
  const result = await pool.query(query);
  
  return result.rows.map(row => ({
    schema: row.schemaname,
    table: row.tablename,
    totalSizePretty: row.size_pretty,
    totalSizeBytes: parseInt(row.size_bytes),
    totalSizeMB: Math.round(parseInt(row.size_bytes) / 1024 / 1024),
    tableSizePretty: row.table_size_pretty,
    tableSizeBytes: parseInt(row.table_size_bytes),
    tableSizeMB: Math.round(parseInt(row.table_size_bytes) / 1024 / 1024),
    indexSizePretty: row.index_size_pretty,
    indexSizeBytes: parseInt(row.index_size_bytes),
    indexSizeMB: Math.round(parseInt(row.index_size_bytes) / 1024 / 1024)
  }));
}

/**
 * Ottiene statistiche dettagliate per tabelle di monitoraggio
 */
async function getMonitoringTableStats() {
  const monitoringTables = [
    'centralized_logs',
    'security_events',
    'performance_metrics',
    'health_checks',
    'access_audit',
    'audit_logs'
  ];
  
  const stats = {};
  
  for (const tableName of monitoringTables) {
    try {
      // Verifica se la tabella esiste
      const existsQuery = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        );
      `;
      
      const existsResult = await pool.query(existsQuery, [tableName]);
      
      if (!existsResult.rows[0].exists) {
        stats[tableName] = { exists: false };
        continue;
      }
      
      // Conta record
      const countQuery = `SELECT COUNT(*) as count FROM ${tableName}`;
      const countResult = await pool.query(countQuery);
      
      // Data più vecchia e più recente
      const dateQuery = `
        SELECT 
          MIN(created_at) as oldest,
          MAX(created_at) as newest,
          COUNT(*) as total_records
        FROM ${tableName}
      `;
      const dateResult = await pool.query(dateQuery);
      
      // Record per giorno (ultimi 30 giorni)
      const dailyQuery = `
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as count
        FROM ${tableName}
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY date DESC
        LIMIT 30
      `;
      const dailyResult = await pool.query(dailyQuery);
      
      stats[tableName] = {
        exists: true,
        totalRecords: parseInt(countResult.rows[0].count),
        oldestRecord: dateResult.rows[0].oldest,
        newestRecord: dateResult.rows[0].newest,
        dailyStats: dailyResult.rows
      };
      
    } catch (error) {
      console.error(`Errore ottenendo statistiche per ${tableName}:`, error);
      stats[tableName] = { exists: false, error: error.message };
    }
  }
  
  return stats;
}

/**
 * Analizza le dimensioni e genera report
 */
async function analyzeDatabaseSize() {
  console.log('📊 Analisi dimensioni database...\n');
  
  // Dimensioni database totale
  const dbSize = await getDatabaseSize();
  console.log(`🗄️ Database totale: ${dbSize.sizePretty} (${dbSize.sizeMB} MB)`);
  
  // Verifica soglie database
  if (dbSize.sizeMB >= SIZE_THRESHOLDS.database.max) {
    console.log('🚨 CRITICO: Database supera soglia massima! Archiviazione immediata necessaria.');
  } else if (dbSize.sizeMB >= SIZE_THRESHOLDS.database.critical) {
    console.log('⚠️ CRITICO: Database supera soglia critica! Archiviazione urgente necessaria.');
  } else if (dbSize.sizeMB >= SIZE_THRESHOLDS.database.warning) {
    console.log('⚠️ WARNING: Database supera soglia di avviso. Considerare archiviazione.');
  } else {
    console.log('✅ Database entro limiti normali.');
  }
  
  console.log('\n📋 Dimensioni tabelle:');
  
  // Dimensioni tabelle
  const tableSizes = await getTableSizes();
  
  for (const table of tableSizes) {
    const status = getTableStatus(table.totalSizeMB);
    console.log(`   ${table.table}: ${table.totalSizePretty} (${table.totalSizeMB} MB) ${status}`);
    
    if (table.totalSizeMB >= SIZE_THRESHOLDS.tables.max) {
      console.log(`     🚨 CRITICO: Tabella supera soglia massima!`);
    } else if (table.totalSizeMB >= SIZE_THRESHOLDS.tables.critical) {
      console.log(`     ⚠️ CRITICO: Tabella supera soglia critica!`);
    } else if (table.totalSizeMB >= SIZE_THRESHOLDS.tables.warning) {
      console.log(`     ⚠️ WARNING: Tabella supera soglia di avviso.`);
    }
  }
  
  // Statistiche tabelle di monitoraggio
  console.log('\n📈 Statistiche tabelle di monitoraggio:');
  const monitoringStats = await getMonitoringTableStats();
  
  for (const [tableName, stats] of Object.entries(monitoringStats)) {
    if (!stats.exists) {
      console.log(`   ${tableName}: Tabella non esiste`);
      continue;
    }
    
    if (stats.error) {
      console.log(`   ${tableName}: Errore - ${stats.error}`);
      continue;
    }
    
    console.log(`   ${tableName}:`);
    console.log(`     - Record totali: ${stats.totalRecords.toLocaleString()}`);
    console.log(`     - Record più vecchio: ${stats.oldestRecord}`);
    console.log(`     - Record più recente: ${stats.newestRecord}`);
    
    if (stats.dailyStats.length > 0) {
      const avgDaily = Math.round(stats.dailyStats.reduce((sum, day) => sum + parseInt(day.count), 0) / stats.dailyStats.length);
      console.log(`     - Media record/giorno (30 giorni): ${avgDaily.toLocaleString()}`);
    }
  }
  
  return {
    databaseSize: dbSize,
    tableSizes,
    monitoringStats
  };
}

/**
 * Determina lo status di una tabella
 */
function getTableStatus(sizeMB) {
  if (sizeMB >= SIZE_THRESHOLDS.tables.max) {
    return '🚨';
  } else if (sizeMB >= SIZE_THRESHOLDS.tables.critical) {
    return '⚠️';
  } else if (sizeMB >= SIZE_THRESHOLDS.tables.warning) {
    return '⚠️';
  } else {
    return '✅';
  }
}

/**
 * Genera raccomandazioni per l'archiviazione
 */
function generateArchivalRecommendations(analysis) {
  console.log('\n💡 Raccomandazioni archiviazione:');
  
  const recommendations = [];
  
  // Raccomandazioni per database totale
  if (analysis.databaseSize.sizeMB >= SIZE_THRESHOLDS.database.max) {
    recommendations.push('🚨 ARCHIVIAZIONE IMMEDIATA: Database supera soglia massima');
  } else if (analysis.databaseSize.sizeMB >= SIZE_THRESHOLDS.database.critical) {
    recommendations.push('⚠️ ARCHIVIAZIONE URGENTE: Database supera soglia critica');
  } else if (analysis.databaseSize.sizeMB >= SIZE_THRESHOLDS.database.warning) {
    recommendations.push('⚠️ ARCHIVIAZIONE CONSIGLIATA: Database supera soglia di avviso');
  }
  
  // Raccomandazioni per tabelle individuali
  for (const table of analysis.tableSizes) {
    if (table.totalSizeMB >= SIZE_THRESHOLDS.tables.max) {
      recommendations.push(`🚨 ARCHIVIAZIONE IMMEDIATA: Tabella ${table.table} supera soglia massima (${table.totalSizeMB} MB)`);
    } else if (table.totalSizeMB >= SIZE_THRESHOLDS.tables.critical) {
      recommendations.push(`⚠️ ARCHIVIAZIONE URGENTE: Tabella ${table.table} supera soglia critica (${table.totalSizeMB} MB)`);
    } else if (table.totalSizeMB >= SIZE_THRESHOLDS.tables.warning) {
      recommendations.push(`⚠️ ARCHIVIAZIONE CONSIGLIATA: Tabella ${table.table} supera soglia di avviso (${table.totalSizeMB} MB)`);
    }
  }
  
  if (recommendations.length === 0) {
    console.log('✅ Nessuna archiviazione necessaria al momento');
  } else {
    recommendations.forEach(rec => console.log(`   ${rec}`));
  }
  
  return recommendations;
}

/**
 * Funzione principale
 */
async function monitorDatabaseSize() {
  try {
    console.log('🔍 Avvio monitoraggio dimensioni database...\n');
    
    const analysis = await analyzeDatabaseSize();
    const recommendations = generateArchivalRecommendations(analysis);
    
    console.log('\n📊 Riepilogo:');
    console.log(`   Database totale: ${analysis.databaseSize.sizePretty}`);
    console.log(`   Tabelle monitorate: ${analysis.tableSizes.length}`);
    console.log(`   Raccomandazioni: ${recommendations.length}`);
    
    return {
      analysis,
      recommendations,
      needsArchival: recommendations.length > 0
    };
    
  } catch (error) {
    console.error('❌ Errore durante monitoraggio:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Esegui se chiamato direttamente
if (require.main === module) {
  monitorDatabaseSize();
}

module.exports = {
  monitorDatabaseSize,
  getDatabaseSize,
  getTableSizes,
  getMonitoringTableStats,
  SIZE_THRESHOLDS
};
