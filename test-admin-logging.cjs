// Test del admin/logging.js aggiornato per compressione
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function testAdminLogging() {
  const client = await pool.connect();
  
  try {
    console.log('🧪 Test admin/logging.js aggiornato...\n');
    
    // 1. Test vista decompressa
    console.log('1. Test vista centralized_logs_decompressed...');
    
    const viewTest = await client.query(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(DISTINCT ip_address) as unique_ips,
        COUNT(DISTINCT user_agent) as unique_user_agents,
        COUNT(DISTINCT endpoint) as unique_endpoints
      FROM centralized_logs_decompressed
      LIMIT 1;
    `);
    
    const viewStats = viewTest.rows[0];
    console.log(`   ✅ Vista funziona: ${viewStats.total_records} record, ${viewStats.unique_ips} IP unici`);
    
    // 2. Test funzioni helper
    console.log('\n2. Test funzioni helper...');
    
    // Test ricerca per IP
    const ipSearchTest = await client.query(`
      SELECT COUNT(*) as count 
      FROM find_logs_by_ip('10.201.190.129');
    `);
    console.log(`   ✅ Ricerca IP: ${ipSearchTest.rows[0].count} record trovati`);
    
    // Test ricerca per User Agent
    const uaSearchTest = await client.query(`
      SELECT COUNT(*) as count 
      FROM find_logs_by_user_agent('Chrome');
    `);
    console.log(`   ✅ Ricerca User Agent: ${uaSearchTest.rows[0].count} record trovati`);
    
    // Test ricerca per Endpoint
    const endpointSearchTest = await client.query(`
      SELECT COUNT(*) as count 
      FROM find_logs_by_endpoint('/api/users/profile');
    `);
    console.log(`   ✅ Ricerca Endpoint: ${endpointSearchTest.rows[0].count} record trovati`);
    
    // 3. Test query aggiornate
    console.log('\n3. Test query aggiornate...');
    
    // Test log recenti
    const recentLogsTest = await client.query(`
      SELECT * FROM centralized_logs_decompressed 
      WHERE timestamp >= NOW() - INTERVAL '24 hours'
      ORDER BY timestamp DESC 
      LIMIT 5;
    `);
    console.log(`   ✅ Log recenti: ${recentLogsTest.rows.length} record trovati`);
    
    // Test log di errore
    const errorLogsTest = await client.query(`
      SELECT * FROM centralized_logs_decompressed 
      WHERE level = 'ERROR' 
      AND timestamp >= NOW() - INTERVAL '24 hours'
      ORDER BY timestamp DESC 
      LIMIT 5;
    `);
    console.log(`   ✅ Log di errore: ${errorLogsTest.rows.length} record trovati`);
    
    // Test ricerca con filtri
    const searchTest = await client.query(`
      SELECT * FROM centralized_logs_decompressed 
      WHERE timestamp >= NOW() - INTERVAL '24 hours'
      AND level = 'INFO'
      ORDER BY timestamp DESC 
      LIMIT 5;
    `);
    console.log(`   ✅ Ricerca con filtri: ${searchTest.rows.length} record trovati`);
    
    // 4. Test esempi di dati decompressi
    console.log('\n4. Esempi di dati decompressi...');
    
    if (recentLogsTest.rows.length > 0) {
      const sampleLog = recentLogsTest.rows[0];
      console.log('   Esempio log decompresso:');
      console.log(`     • Timestamp: ${sampleLog.timestamp}`);
      console.log(`     • Level: ${sampleLog.level}`);
      console.log(`     • IP: ${sampleLog.ip_address}`);
      console.log(`     • User Agent: ${sampleLog.user_agent}`);
      console.log(`     • Endpoint: ${sampleLog.endpoint}`);
      console.log(`     • Message: ${sampleLog.message?.substring(0, 50)}...`);
    }
    
    // 5. Test performance
    console.log('\n5. Test performance...');
    
    const startTime = Date.now();
    await client.query(`
      SELECT COUNT(*) FROM centralized_logs_decompressed 
      WHERE timestamp >= NOW() - INTERVAL '24 hours';
    `);
    const endTime = Date.now();
    
    console.log(`   ✅ Query performance: ${endTime - startTime}ms`);
    
    console.log('\n✅ Tutti i test del admin/logging.js completati con successo!');
    
  } catch (error) {
    console.error('❌ Errore test admin/logging.js:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Esegui se chiamato direttamente
if (require.main === module) {
  testAdminLogging()
    .then(() => {
      console.log('\n🎉 Test admin/logging.js completato!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Errore test:', error);
      process.exit(1);
    });
}

module.exports = { testAdminLogging };
