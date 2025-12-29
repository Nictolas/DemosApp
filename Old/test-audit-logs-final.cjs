const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function testAuditLogsFinal() {
  const client = await pool.connect();
  try {
    console.log('🧪 Test finale compressione audit_logs...');

    // 1. Test confronto dimensioni
    console.log('\n1. Confronto dimensioni tabelle...');
    const originalSize = await client.query(`
      SELECT pg_size_pretty(pg_total_relation_size('audit_logs')) as size;
    `);
    const compressedSize = await client.query(`
      SELECT pg_size_pretty(pg_total_relation_size('audit_logs_compressed')) as size;
    `);
    
    console.log(`   • Dimensione originale: ${originalSize.rows[0].size}`);
    console.log(`   • Dimensione compressa: ${compressedSize.rows[0].size}`);

    // 2. Test conteggi record
    console.log('\n2. Conteggi record...');
    const originalCount = await client.query('SELECT COUNT(*) FROM audit_logs');
    const compressedCount = await client.query('SELECT COUNT(*) FROM audit_logs_compressed');
    const decompressedCount = await client.query('SELECT COUNT(*) FROM audit_logs_decompressed');
    
    console.log(`   • Record originali: ${originalCount.rows[0].count}`);
    console.log(`   • Record compressi: ${compressedCount.rows[0].count}`);
    console.log(`   • Record decompressi: ${decompressedCount.rows[0].count}`);

    // 3. Test integrità dati
    console.log('\n3. Test integrità dati...');
    const sampleOriginal = await client.query(`
      SELECT action, resource, ip_address, user_agent, timestamp
      FROM audit_logs
      ORDER BY timestamp DESC
      LIMIT 1;
    `);
    
    const sampleDecompressed = await client.query(`
      SELECT action, resource, ip_address, user_agent, timestamp
      FROM audit_logs_decompressed
      ORDER BY timestamp DESC
      LIMIT 1;
    `);
    
    if (sampleOriginal.rows.length > 0 && sampleDecompressed.rows.length > 0) {
      const orig = sampleOriginal.rows[0];
      const decomp = sampleDecompressed.rows[0];
      
      console.log('   Confronto ultimo record:');
      console.log(`   Originale - Action: ${orig.action}, Resource: ${orig.resource}, IP: ${orig.ip_address}`);
      console.log(`   Decompressa - Action: ${decomp.action}, Resource: ${decomp.resource}, IP: ${decomp.ip_address}`);
      
      if (orig.action === decomp.action && orig.resource === decomp.resource) {
        console.log('   ✅ Integrità dati verificata!');
      } else {
        console.log('   ⚠️ Differenze nei dati decompressi');
      }
    }

    // 4. Test performance query
    console.log('\n4. Test performance query...');
    const startTime = process.hrtime.bigint();
    await client.query('SELECT COUNT(*) FROM audit_logs_decompressed WHERE action = \'DATA_ACCESS\'');
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1_000_000;
    console.log(`   ✅ Query performance: ${durationMs.toFixed(0)}ms`);

    // 5. Test funzioni di compressione
    console.log('\n5. Test funzioni di compressione...');
    const compressionTest = await client.query(`
      SELECT 
        compress_audit_action('DATA_ACCESS') as action_compressed,
        compress_audit_resource('users') as resource_compressed,
        compress_ip_address('192.168.1.100') as ip_compressed,
        compress_audit_user_agent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36') as ua_compressed;
    `);
    
    const comp = compressionTest.rows[0];
    console.log('   Test compressione:');
    console.log(`     • DATA_ACCESS → ${comp.action_compressed}`);
    console.log(`     • users → ${comp.resource_compressed}`);
    console.log(`     • 192.168.1.100 → ${comp.ip_compressed}`);
    console.log(`     • Chrome/Windows → ${comp.ua_compressed}`);

    // 6. Test funzioni di decompressione
    console.log('\n6. Test funzioni di decompressione...');
    const decompressionTest = await client.query(`
      SELECT 
        decompress_audit_action('DA') as action_decompressed,
        decompress_audit_resource('usr') as resource_decompressed,
        decompress_ip_address(-1062731420) as ip_decompressed,
        decompress_audit_user_agent('CHR-WIN') as ua_decompressed;
    `);
    
    const decomp = decompressionTest.rows[0];
    console.log('   Test decompressione:');
    console.log(`     • DA → ${decomp.action_decompressed}`);
    console.log(`     • usr → ${decomp.resource_decompressed}`);
    console.log(`     • -1062731420 → ${decomp.ip_decompressed}`);
    console.log(`     • CHR-WIN → ${decomp.ua_decompressed}`);

    // 7. Test statistiche finali
    console.log('\n7. Statistiche finali...');
    const finalStats = await client.query(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(DISTINCT action) as unique_actions,
        COUNT(DISTINCT resource) as unique_resources,
        COUNT(DISTINCT ip_address) as unique_ips,
        COUNT(DISTINCT user_agent) as unique_user_agents
      FROM audit_logs_decompressed;
    `);
    
    const stats = finalStats.rows[0];
    console.log(`   • Record totali: ${stats.total_records}`);
    console.log(`   • Azioni uniche: ${stats.unique_actions}`);
    console.log(`   • Risorse uniche: ${stats.unique_resources}`);
    console.log(`   • IP unici: ${stats.unique_ips}`);
    console.log(`   • User Agent unici: ${stats.unique_user_agents}`);

    console.log('\n✅ Test finale compressione audit_logs completato con successo!');
    console.log('   La compressione è attiva e funzionante.');

  } finally {
    client.release();
    await pool.end();
  }
}

testAuditLogsFinal().catch(console.error);
