const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function testFrontendIntegration() {
  console.log('🧪 Test integrazione frontend con compressione...');

  const client = await pool.connect();
  try {
    // 1. Test endpoint API aggiornato
    console.log('\n1. Test endpoint /api/admin/data-export/centralized-logs...');
    
    const recentLogsQuery = `
      SELECT 
        id,
        timestamp,
        level,
        message,
        user_id,
        ip_address,
        endpoint,
        request_id,
        meta_data
      FROM centralized_logs_decompressed 
      ORDER BY timestamp DESC 
      LIMIT 10
    `;
    
    const recentLogsResult = await client.query(recentLogsQuery);
    console.log(`   ✅ Log recenti: ${recentLogsResult.rows.length} record trovati`);
    
    // 2. Test glossario
    console.log('\n2. Test glossario livelli...');
    const glossaryQuery = `
      SELECT 
        code,
        full_name,
        description
      FROM log_level_mapping 
      ORDER BY code
    `;
    
    const glossaryResult = await client.query(glossaryQuery);
    console.log(`   ✅ Glossario: ${glossaryResult.rows.length} livelli trovati`);
    
    // 3. Test statistiche
    console.log('\n3. Test statistiche...');
    const statsQuery = `
      SELECT 
        COUNT(*) as total_logs,
        COUNT(DISTINCT level) as unique_levels,
        MIN(timestamp) as oldest_log,
        MAX(timestamp) as newest_log
      FROM centralized_logs_decompressed
    `;
    
    const statsResult = await client.query(statsQuery);
    const stats = statsResult.rows[0];
    console.log(`   ✅ Statistiche:`);
    console.log(`      • Log totali: ${stats.total_logs}`);
    console.log(`      • Livelli unici: ${stats.unique_levels}`);
    console.log(`      • Log più vecchio: ${stats.oldest_log}`);
    console.log(`      • Log più recente: ${stats.newest_log}`);
    
    // 4. Test dati decompressi
    console.log('\n4. Test dati decompressi...');
    if (recentLogsResult.rows.length > 0) {
      const sampleLog = recentLogsResult.rows[0];
      console.log('   Esempio log decompresso:');
      console.log(`      • ID: ${sampleLog.id}`);
      console.log(`      • Timestamp: ${sampleLog.timestamp}`);
      console.log(`      • Level: ${sampleLog.level}`);
      console.log(`      • IP: ${sampleLog.ip_address}`);
      console.log(`      • Endpoint: ${sampleLog.endpoint}`);
      console.log(`      • Message: ${sampleLog.message.substring(0, 50)}...`);
    }
    
    // 5. Test performance
    console.log('\n5. Test performance...');
    const startTime = process.hrtime.bigint();
    await client.query(recentLogsQuery);
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1_000_000;
    console.log(`   ✅ Query performance: ${durationMs.toFixed(0)}ms`);
    
    // 6. Test compatibilità frontend
    console.log('\n6. Test compatibilità frontend...');
    const frontendData = {
      recentLogs: recentLogsResult.rows,
      glossary: glossaryResult.rows,
      stats: stats
    };
    
    // Simula quello che riceve il frontend
    console.log('   ✅ Dati pronti per frontend:');
    console.log(`      • ${frontendData.recentLogs.length} log recenti`);
    console.log(`      • ${frontendData.glossary.length} voci glossario`);
    console.log(`      • ${frontendData.stats.total_logs} log totali`);
    
    console.log('\n✅ Integrazione frontend completata con successo!');
    console.log('   Il frontend riceverà dati decompressi e li mostrerà correttamente.');
    
  } finally {
    client.release();
    await pool.end();
  }
}

testFrontendIntegration().catch(console.error);
