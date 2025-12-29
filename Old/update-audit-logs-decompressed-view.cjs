const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function updateAuditLogsDecompressedView() {
  const client = await pool.connect();
  try {
    console.log('🔧 Aggiornamento vista audit_logs_decompressed...');

    // Aggiorna la vista per usare la tabella compressa
    await client.query(`
      CREATE OR REPLACE VIEW audit_logs_decompressed AS
      SELECT 
        id,
        user_id,
        decompress_audit_action(action) as action,
        decompress_audit_resource(resource) as resource,
        resource_id,
        details,
        decompress_ip_address(ip_address) as ip_address,
        decompress_audit_user_agent(user_agent) as user_agent,
        to_timestamp(timestamp / 1000) as timestamp,
        success,
        error_message,
        to_timestamp(created_at / 1000) as created_at
      FROM audit_logs_compressed;
    `);
    console.log('✅ Vista audit_logs_decompressed aggiornata');

    // Test della vista aggiornata
    console.log('\n🧪 Test vista aggiornata...');
    const testResult = await client.query(`
      SELECT 
        id,
        user_id,
        action,
        resource,
        ip_address,
        user_agent,
        timestamp,
        success
      FROM audit_logs_decompressed
      ORDER BY timestamp DESC
      LIMIT 5;
    `);
    
    console.log('   Esempi di dati decompressi:');
    testResult.rows.forEach((row, i) => {
      console.log(`   ${i+1}. ID: ${row.id.substring(0, 8)}...`);
      console.log(`      Action: ${row.action}`);
      console.log(`      Resource: ${row.resource}`);
      console.log(`      IP: ${row.ip_address}`);
      console.log(`      User Agent: ${row.user_agent}`);
      console.log(`      Timestamp: ${row.timestamp}`);
      console.log(`      Success: ${row.success}`);
    });

    // Verifica che i dati siano identici all'originale
    console.log('\n🔍 Verifica integrità dati...');
    const originalCount = await client.query('SELECT COUNT(*) FROM audit_logs');
    const decompressedCount = await client.query('SELECT COUNT(*) FROM audit_logs_decompressed');
    
    console.log(`   • Record originali: ${originalCount.rows[0].count}`);
    console.log(`   • Record decompressi: ${decompressedCount.rows[0].count}`);
    
    if (originalCount.rows[0].count === decompressedCount.rows[0].count) {
      console.log('   ✅ Integrità dati verificata!');
    } else {
      console.log('   ⚠️ Attenzione: Numero di record non corrisponde');
    }

    // Test performance
    console.log('\n⚡ Test performance...');
    const startTime = process.hrtime.bigint();
    await client.query('SELECT COUNT(*) FROM audit_logs_decompressed WHERE action = \'DATA_ACCESS\'');
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1_000_000;
    console.log(`   ✅ Query performance: ${durationMs.toFixed(0)}ms`);

    console.log('\n✅ Vista audit_logs_decompressed aggiornata con successo!');

  } finally {
    client.release();
    await pool.end();
  }
}

updateAuditLogsDecompressedView().catch(console.error);
