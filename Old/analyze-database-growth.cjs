// File: analyze-database-growth.cjs
// Analisi della crescita del database dopo l'ottimizzazione

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function analyzeDatabaseGrowth() {
  try {
    console.log('🔍 ANALISI CRESCITA DATABASE DOPO OTTIMIZZAZIONE');
    console.log('='.repeat(60));
    
    // 1. Dimensione totale database
    const totalSize = await pool.query('SELECT pg_size_pretty(pg_database_size(current_database())) as total_size');
    console.log(`💾 Dimensione totale database: ${totalSize.rows[0].total_size}`);
    
    // 2. Top 10 tabelle per dimensione
    console.log('\n📊 TOP 10 TABELLE PER DIMENSIONE:');
    console.log('─'.repeat(50));
    
    const topTables = await pool.query(`
      SELECT 
        tablename,
        pg_size_pretty(pg_total_relation_size('public.' || tablename)) as size,
        pg_total_relation_size('public.' || tablename) as size_bytes
      FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY pg_total_relation_size('public.' || tablename) DESC 
      LIMIT 10
    `);
    
    topTables.rows.forEach((row, index) => {
      console.log(`${(index + 1).toString().padStart(2)}. ${row.tablename.padEnd(30)} | ${row.size.padStart(8)}`);
    });
    
    // 3. Analisi centralized_logs
    console.log('\n📋 ANALISI CENTRALIZED_LOGS:');
    console.log('─'.repeat(40));
    
    const centralizedLogs = await pool.query(`
      SELECT 
        COUNT(*) as record_count,
        pg_size_pretty(pg_total_relation_size('centralized_logs')) as table_size,
        pg_size_pretty(pg_relation_size('centralized_logs')) as data_size,
        pg_size_pretty(pg_total_relation_size('centralized_logs') - pg_relation_size('centralized_logs')) as index_size,
        MIN(timestamp) as oldest_record,
        MAX(timestamp) as newest_record
      FROM centralized_logs
    `);
    
    const logs = centralizedLogs.rows[0];
    console.log(`📈 Record totali: ${logs.record_count.toLocaleString()}`);
    console.log(`💾 Dimensione tabella: ${logs.table_size}`);
    console.log(`📊 Dimensione dati: ${logs.data_size}`);
    console.log(`🔍 Dimensione indici: ${logs.index_size}`);
    console.log(`📅 Range: ${logs.oldest_record} → ${logs.newest_record}`);
    
    // 4. Analisi frammentazione
    console.log('\n🔍 ANALISI FRAMMENTAZIONE:');
    console.log('─'.repeat(40));
    
    const fragmentation = await pool.query(`
      SELECT 
        schemaname,
        tablename,
        n_dead_tup as dead_tuples,
        n_live_tup as live_tuples,
        ROUND(n_dead_tup::numeric / (n_live_tup + n_dead_tup) * 100, 2) as fragmentation_percent
      FROM pg_stat_user_tables 
      WHERE schemaname = 'public' 
        AND (n_dead_tup + n_live_tup) > 0
      ORDER BY n_dead_tup DESC
      LIMIT 5
    `);
    
    fragmentation.rows.forEach(row => {
      if (row.dead_tuples > 0) {
        console.log(`📋 ${row.tablename.padEnd(25)} | ${row.dead_tuples.toLocaleString().padStart(8)} dead tuples (${row.fragmentation_percent}%)`);
      }
    });
    
    // 5. Analisi tabelle di backup
    console.log('\n💾 ANALISI TABELLE DI BACKUP:');
    console.log('─'.repeat(40));
    
    const backupTables = await pool.query(`
      SELECT 
        tablename,
        pg_size_pretty(pg_total_relation_size('public.' || tablename)) as size,
        COUNT(*) as record_count
      FROM pg_tables t
      LEFT JOIN centralized_logs c ON t.tablename = 'centralized_logs'
      WHERE schemaname = 'public' 
        AND tablename LIKE '%backup%'
      GROUP BY tablename, pg_total_relation_size('public.' || tablename)
      ORDER BY pg_total_relation_size('public.' || tablename) DESC
    `);
    
    if (backupTables.rows.length > 0) {
      backupTables.rows.forEach(row => {
        console.log(`📋 ${row.tablename.padEnd(30)} | ${row.size.padStart(8)} | ${row.record_count.toLocaleString()} record`);
      });
    } else {
      console.log('✅ Nessuna tabella di backup trovata');
    }
    
    // 6. Raccomandazioni
    console.log('\n💡 RACCOMANDAZIONI:');
    console.log('─'.repeat(40));
    
    const totalSizeMB = parseInt(totalSize.rows[0].total_size.replace(' MB', ''));
    const centralizedLogsMB = parseInt(logs.table_size.replace(' MB', ''));
    
    if (totalSizeMB > 80) {
      console.log('🔴 Database grande - richiede ottimizzazione immediata');
    }
    
    if (centralizedLogsMB > 60) {
      console.log('🔴 centralized_logs ancora troppo grande');
    }
    
    const deadTuples = fragmentation.rows.reduce((sum, row) => sum + parseInt(row.dead_tuples), 0);
    if (deadTuples > 10000) {
      console.log('🔴 Molti dead tuples - esegui VACUUM FULL');
    }
    
    console.log('\n🛠️ AZIONI IMMEDIATE:');
    console.log('1. Esegui VACUUM FULL per liberare spazio');
    console.log('2. Elimina tabelle di backup se non necessarie');
    console.log('3. Implementa retention policy più aggressiva');
    console.log('4. Considera archiviazione su storage esterno');
    
  } catch (error) {
    console.error('❌ Errore durante analisi:', error);
  } finally {
    await pool.end();
  }
}

// Esegui analisi
if (require.main === module) {
  analyzeDatabaseGrowth();
}

module.exports = { analyzeDatabaseGrowth };
