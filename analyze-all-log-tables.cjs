// File: analyze-all-log-tables.cjs
// Analisi di tutte le tabelle di log per identificare ottimizzazioni

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function analyzeAllLogTables() {
  try {
    console.log('🔍 ANALISI TUTTE LE TABELLE DI LOG');
    console.log('='.repeat(60));
    
    // 1. Trova tutte le tabelle di log
    const logTables = await findLogTables();
    
    // 2. Analizza ogni tabella
    for (const table of logTables) {
      await analyzeLogTable(table);
    }
    
    // 3. Proposta configurazione logging ottimizzata
    await proposeLoggingConfiguration();
    
  } catch (error) {
    console.error('❌ Errore durante analisi:', error);
  } finally {
    await pool.end();
  }
}

/**
 * Trova tutte le tabelle di log
 */
async function findLogTables() {
  console.log('\n📋 RICERCA TABELLE DI LOG...');
  
  const result = await pool.query(`
    SELECT 
      table_name,
      pg_size_pretty(pg_total_relation_size(table_name::regclass)) as size,
      (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as columns
    FROM information_schema.tables t 
    WHERE table_schema = 'public' 
      AND (table_name LIKE '%log%' OR table_name LIKE '%audit%' OR table_name LIKE '%metric%')
    ORDER BY pg_total_relation_size(table_name::regclass) DESC
  `);
  
  console.log('📊 TABELLE DI LOG TROVATE:');
  console.log('─'.repeat(50));
  result.rows.forEach(row => {
    console.log(`📋 ${row.table_name.padEnd(25)} | ${row.size.padStart(8)} | ${row.columns} colonne`);
  });
  
  return result.rows;
}

/**
 * Analizza una singola tabella di log
 */
async function analyzeLogTable(table) {
  console.log(`\n🔍 ANALISI TABELLA: ${table.table_name}`);
  console.log('─'.repeat(40));
  
  try {
    // Conta record
    const countResult = await pool.query(`SELECT COUNT(*) as count FROM ${table.table_name}`);
    const recordCount = countResult.rows[0].count;
    
    // Analizza età dei dati
    const ageResult = await pool.query(`
      SELECT 
        MIN(created_at) as oldest,
        MAX(created_at) as newest,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '1 day' THEN 1 END) as last_day,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END) as last_week,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '30 days' THEN 1 END) as last_month
      FROM ${table.table_name}
    `);
    
    const age = ageResult.rows[0];
    
    console.log(`📈 Record totali: ${recordCount.toLocaleString()}`);
    console.log(`📅 Range: ${age.oldest} → ${age.newest}`);
    console.log(`⏰ Ultimo giorno: ${age.last_day.toLocaleString()}`);
    console.log(`⏰ Ultima settimana: ${age.last_week.toLocaleString()}`);
    console.log(`⏰ Ultimo mese: ${age.last_month.toLocaleString()}`);
    
    // Analizza tipi di dati se è una tabella di log
    if (table.table_name.includes('log')) {
      await analyzeLogContent(table.table_name);
    }
    
    // Suggerimenti di ottimizzazione
    await suggestOptimizations(table, recordCount, age);
    
  } catch (error) {
    console.log(`⚠️ Errore analisi ${table.table_name}: ${error.message}`);
  }
}

/**
 * Analizza contenuto dei log
 */
async function analyzeLogContent(tableName) {
  try {
    // Verifica se ha colonna level
    const levelResult = await pool.query(`
      SELECT COUNT(*) as count 
      FROM ${tableName} 
      WHERE level IS NOT NULL
    `);
    
    if (levelResult.rows[0].count > 0) {
      const levels = await pool.query(`
        SELECT level, COUNT(*) as count
        FROM ${tableName}
        GROUP BY level
        ORDER BY count DESC
      `);
      
      console.log('📊 Distribuzione livelli:');
      levels.rows.forEach(row => {
        console.log(`   ${row.level}: ${row.count.toLocaleString()} record`);
      });
    }
    
    // Verifica se ha colonna message
    const messageResult = await pool.query(`
      SELECT 
        AVG(LENGTH(message)) as avg_length,
        MAX(LENGTH(message)) as max_length,
        COUNT(CASE WHEN LENGTH(message) > 500 THEN 1 END) as long_messages
      FROM ${tableName}
      WHERE message IS NOT NULL
    `);
    
    if (messageResult.rows[0].avg_length) {
      const msg = messageResult.rows[0];
      console.log(`📝 Messaggi: media ${Math.round(msg.avg_length)} chars, max ${msg.max_length} chars`);
      console.log(`📝 Messaggi lunghi (>500 chars): ${msg.long_messages.toLocaleString()}`);
    }
    
  } catch (error) {
    // Ignora errori se la colonna non esiste
  }
}

/**
 * Suggerisce ottimizzazioni per una tabella
 */
async function suggestOptimizations(table, recordCount, age) {
  console.log('💡 SUGGERIMENTI OTTIMIZZAZIONE:');
  
  const sizeMB = parseInt(table.size.replace(' MB', ''));
  const isLarge = sizeMB > 10;
  const isOld = age.oldest && new Date(age.oldest) < new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const isGrowing = age.last_day > 1000;
  
  if (isLarge) {
    console.log('   🔴 Tabella grande - richiede ottimizzazione');
  }
  
  if (isOld) {
    console.log('   🟡 Dati vecchi presenti - implementa retention policy');
  }
  
  if (isGrowing) {
    console.log('   🟠 Crescita rapida - monitora e ottimizza');
  }
  
  if (!isLarge && !isOld && !isGrowing) {
    console.log('   ✅ Tabella ottimizzata');
  }
}

/**
 * Proposta configurazione logging ottimizzata
 */
async function proposeLoggingConfiguration() {
  console.log('\n🚀 CONFIGURAZIONE LOGGING OTTIMIZZATA');
  console.log('='.repeat(60));
  
  console.log('\n📋 CONFIGURAZIONE RACCOMANDATA:');
  console.log('─'.repeat(40));
  
  console.log('\n1. 🎯 LIVELLI DI LOG PER AMBIENTE:');
  console.log('   • PRODUZIONE: ERROR, WARN, INFO (solo essenziali)');
  console.log('   • STAGING: ERROR, WARN, INFO, DEBUG');
  console.log('   • SVILUPPO: Tutti i livelli');
  
  console.log('\n2. ⏰ RETENTION POLICY:');
  console.log('   • ERROR: 2 anni (sicurezza)');
  console.log('   • WARN: 1 anno (monitoraggio)');
  console.log('   • INFO: 6 mesi (audit)');
  console.log('   • DEBUG: 30 giorni (debugging)');
  console.log('   • TRACE: 7 giorni (trace)');
  
  console.log('\n3. 🗄️ ARCHIVIAZIONE:');
  console.log('   • Dati 6+ mesi → Storage esterno');
  console.log('   • Compressione e crittografia');
  console.log('   • Backup prima dell\'eliminazione');
  
  console.log('\n4. 📊 MONITORAGGIO:');
  console.log('   • Dashboard dimensioni tabelle');
  console.log('   • Alert crescita eccessiva');
  console.log('   • Report conformità GDPR');
  
  console.log('\n5. 🔧 CONFIGURAZIONE AUTOMATICA:');
  console.log('   • Job giornaliero pulizia');
  console.log('   • Retention policy automatica');
  console.log('   • Archiviazione schedulata');
  
  console.log('\n⚖️ CONFORMITÀ GDPR:');
  console.log('   ✅ Art. 5(1)(e) - Limitazione conservazione');
  console.log('   ✅ Art. 32 - Sicurezza del trattamento');
  console.log('   ✅ Privacy by Design - Ottimizzazione automatica');
  
  console.log('\n🛠️ IMPLEMENTAZIONE:');
  console.log('   1. Configura livelli per ambiente');
  console.log('   2. Implementa retention automatica');
  console.log('   3. Setup archiviazione esterna');
  console.log('   4. Monitora e ottimizza continuamente');
}

// Esegui analisi
if (require.main === module) {
  analyzeAllLogTables();
}

module.exports = { analyzeAllLogTables };
