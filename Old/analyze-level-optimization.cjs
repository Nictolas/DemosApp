// File: analyze-level-optimization.cjs
// Analisi dell'ottimizzazione della colonna 'level' in centralized_logs

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function analyzeLevelOptimization() {
  try {
    console.log('🔍 ANALISI OTTIMIZZAZIONE COLONNA LEVEL');
    console.log('='.repeat(60));
    
    // 1. Analisi distribuzione livelli
    console.log('\n📊 DISTRIBUZIONE LIVELLI ATTUALE:');
    console.log('─'.repeat(50));
    
    const levelStats = await pool.query(`
      SELECT 
        level, 
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage,
        pg_size_pretty(SUM(pg_column_size(level))) as total_size,
        SUM(pg_column_size(level)) as total_bytes
      FROM centralized_logs 
      GROUP BY level 
      ORDER BY count DESC
    `);
    
    levelStats.rows.forEach(row => {
      console.log(`📋 ${row.level.padEnd(8)} | ${row.count.toLocaleString().padStart(8)} record (${row.percentage}%) | ${row.total_size}`);
    });
    
    // 2. Calcolo risparmio potenziale
    console.log('\n💰 CALCOLO RISPARMIO POTENZIALE:');
    console.log('─'.repeat(50));
    
    const totalRecords = levelStats.rows.reduce((sum, row) => sum + parseInt(row.count), 0);
    const totalBytes = levelStats.rows.reduce((sum, row) => sum + parseInt(row.total_bytes), 0);
    
    console.log(`📈 Record totali: ${totalRecords.toLocaleString()}`);
    console.log(`💾 Spazio attuale colonna level: ${(totalBytes / 1024).toFixed(2)} KB`);
    
    // 3. Mappatura ottimizzata
    const levelMapping = {
      'ERROR': 'E',
      'WARN': 'W', 
      'INFO': 'I',
      'DEBUG': 'D',
      'TRACE': 'T'
    };
    
    console.log('\n🗂️ MAPPATURA OTTIMIZZATA:');
    console.log('─'.repeat(30));
    Object.entries(levelMapping).forEach(([full, short]) => {
      const row = levelStats.rows.find(r => r.level === full);
      if (row) {
        const currentBytes = parseInt(row.total_bytes);
        const optimizedBytes = parseInt(row.count); // 1 byte per carattere
        const savedBytes = currentBytes - optimizedBytes;
        console.log(`${full.padEnd(8)} → ${short} | ${row.count.toLocaleString().padStart(8)} record | Risparmio: ${savedBytes} bytes`);
      }
    });
    
    // 4. Calcolo risparmio totale
    let totalSavedBytes = 0;
    levelStats.rows.forEach(row => {
      const currentBytes = parseInt(row.total_bytes);
      const optimizedBytes = parseInt(row.count); // 1 byte per carattere
      totalSavedBytes += (currentBytes - optimizedBytes);
    });
    
    console.log('\n💡 RISULTATO OTTIMIZZAZIONE:');
    console.log('─'.repeat(40));
    console.log(`💾 Spazio attuale: ${(totalBytes / 1024).toFixed(2)} KB`);
    console.log(`💾 Spazio ottimizzato: ${(totalBytes - totalSavedBytes) / 1024} KB`);
    console.log(`💰 Risparmio: ${(totalSavedBytes / 1024).toFixed(2)} KB`);
    console.log(`📊 Percentuale risparmio: ${((totalSavedBytes / totalBytes) * 100).toFixed(2)}%`);
    
    // 5. Analisi altre colonne ottimizzabili
    console.log('\n🔍 ANALISI ALTRE COLONNE OTTIMIZZABILI:');
    console.log('─'.repeat(50));
    
    const columnAnalysis = await pool.query(`
      SELECT 
        'hostname' as column_name,
        COUNT(*) as total_records,
        AVG(LENGTH(hostname)) as avg_length,
        MAX(LENGTH(hostname)) as max_length,
        pg_size_pretty(SUM(pg_column_size(hostname))) as total_size
      FROM centralized_logs
      WHERE hostname IS NOT NULL
      
      UNION ALL
      
      SELECT 
        'message' as column_name,
        COUNT(*) as total_records,
        AVG(LENGTH(message)) as avg_length,
        MAX(LENGTH(message)) as max_length,
        pg_size_pretty(SUM(pg_column_size(message))) as total_size
      FROM centralized_logs
      WHERE message IS NOT NULL
      
      UNION ALL
      
      SELECT 
        'endpoint' as column_name,
        COUNT(*) as total_records,
        AVG(LENGTH(endpoint)) as avg_length,
        MAX(LENGTH(endpoint)) as max_length,
        pg_size_pretty(SUM(pg_column_size(endpoint))) as total_size
      FROM centralized_logs
      WHERE endpoint IS NOT NULL
    `);
    
    columnAnalysis.rows.forEach(row => {
      console.log(`📋 ${row.column_name.padEnd(12)} | ${row.total_records.toLocaleString().padStart(8)} record | Avg: ${parseInt(row.avg_length)} chars | Max: ${parseInt(row.max_length)} chars | ${row.total_size}`);
    });
    
    // 6. Raccomandazioni
    console.log('\n💡 RACCOMANDAZIONI:');
    console.log('─'.repeat(40));
    
    if (totalSavedBytes > 1024) { // Se risparmio > 1KB
      console.log('✅ OTTIMIZZAZIONE LEVEL: Conveniente');
      console.log('   • Risparmio significativo di spazio');
      console.log('   • Implementazione semplice');
      console.log('   • Miglioramento performance query');
    } else {
      console.log('⚠️ OTTIMIZZAZIONE LEVEL: Non conveniente');
      console.log('   • Risparmio minimo di spazio');
      console.log('   • Complessità aggiuntiva');
      console.log('   • Focus su altre ottimizzazioni');
    }
    
    console.log('\n🎯 TECNICHE DI OTTIMIZZAZIONE DATABASE:');
    console.log('─'.repeat(50));
    console.log('1. 📝 Data Compression: Riduzione dimensioni colonne');
    console.log('2. 🗂️ Normalization: Separazione dati in tabelle');
    console.log('3. 📊 Column Encoding: Codifica valori ripetuti');
    console.log('4. 🔄 Data Archiving: Spostamento dati vecchi');
    console.log('5. 📦 Table Partitioning: Divisione tabelle grandi');
    console.log('6. 🗃️ Index Optimization: Ottimizzazione indici');
    
  } catch (error) {
    console.error('❌ Errore durante analisi:', error);
  } finally {
    await pool.end();
  }
}

// Esegui analisi
if (require.main === module) {
  analyzeLevelOptimization();
}

module.exports = { analyzeLevelOptimization };
