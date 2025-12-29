const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function testAuditLogsCompression() {
  const client = await pool.connect();
  try {
    console.log('🧪 Test completo compressione audit_logs...');

    // 1. Test vista decompressa
    console.log('\n1. Test vista audit_logs_decompressed...');
    const viewTest = await client.query('SELECT COUNT(*) FROM audit_logs_decompressed');
    console.log(`   ✅ Vista funziona: ${viewTest.rows[0].count} record`);

    // 2. Test funzioni di decompressione
    console.log('\n2. Test funzioni di decompressione...');
    const decompressionTest = await client.query(`
      SELECT 
        action,
        resource,
        ip_address,
        user_agent,
        timestamp
      FROM audit_logs_decompressed
      WHERE action = 'DATA_ACCESS'
      LIMIT 3;
    `);
    
    console.log('   Esempi di decompressione:');
    decompressionTest.rows.forEach((row, i) => {
      console.log(`   ${i+1}. Action: ${row.action}`);
      console.log(`      Resource: ${row.resource}`);
      console.log(`      IP: ${row.ip_address}`);
      console.log(`      User Agent: ${row.user_agent}`);
      console.log(`      Timestamp: ${row.timestamp}`);
    });

    // 3. Test confronto con dati originali
    console.log('\n3. Test confronto con dati originali...');
    const originalSample = await client.query(`
      SELECT action, resource, ip_address, user_agent, timestamp
      FROM audit_logs
      WHERE action = 'DATA_ACCESS'
      LIMIT 1;
    `);
    
    const decompressedSample = await client.query(`
      SELECT action, resource, ip_address, user_agent, timestamp
      FROM audit_logs_decompressed
      WHERE action = 'DATA_ACCESS'
      LIMIT 1;
    `);
    
    if (originalSample.rows.length > 0 && decompressedSample.rows.length > 0) {
      const orig = originalSample.rows[0];
      const decomp = decompressedSample.rows[0];
      
      console.log('   Confronto dati:');
      console.log(`   Originale - Action: ${orig.action}, Resource: ${orig.resource}`);
      console.log(`   Decompressa - Action: ${decomp.action}, Resource: ${decomp.resource}`);
      
      if (orig.action === decomp.action && orig.resource === decomp.resource) {
        console.log('   ✅ Dati decompressi correttamente!');
      } else {
        console.log('   ⚠️ Differenze nei dati decompressi');
      }
    }

    // 4. Test performance
    console.log('\n4. Test performance...');
    const startTime = process.hrtime.bigint();
    await client.query('SELECT COUNT(*) FROM audit_logs_decompressed WHERE action = \'DATA_ACCESS\'');
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1_000_000;
    console.log(`   ✅ Query performance: ${durationMs.toFixed(0)}ms`);

    // 5. Test statistiche
    console.log('\n5. Test statistiche...');
    const stats = await client.query(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(DISTINCT action) as unique_actions,
        COUNT(DISTINCT ip_address) as unique_ips,
        COUNT(DISTINCT user_agent) as unique_user_agents
      FROM audit_logs_decompressed;
    `);
    
    const s = stats.rows[0];
    console.log(`   • Record totali: ${s.total_records}`);
    console.log(`   • Azioni uniche: ${s.unique_actions}`);
    console.log(`   • IP unici: ${s.unique_ips}`);
    console.log(`   • User Agent unici: ${s.unique_user_agents}`);

    // 6. Test dimensioni tabelle
    console.log('\n6. Test dimensioni tabelle...');
    const originalSize = await client.query(`
      SELECT pg_size_pretty(pg_total_relation_size('audit_logs')) as size;
    `);
    const compressedSize = await client.query(`
      SELECT pg_size_pretty(pg_total_relation_size('audit_logs_compressed')) as size;
    `);
    
    console.log(`   • Dimensione originale: ${originalSize.rows[0].size}`);
    console.log(`   • Dimensione compressa: ${compressedSize.rows[0].size}`);

    console.log('\n✅ Test compressione audit_logs completato con successo!');

  } finally {
    client.release();
    await pool.end();
  }
}

testAuditLogsCompression().catch(console.error);
