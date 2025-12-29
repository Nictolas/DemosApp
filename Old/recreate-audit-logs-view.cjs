const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function recreateView() {
  const client = await pool.connect();
  try {
    console.log('🔧 Ricreazione vista audit_logs_decompressed...');
    
    // Elimina la vista esistente
    await client.query('DROP VIEW IF EXISTS audit_logs_decompressed');
    console.log('✅ Vista esistente eliminata');
    
    // Crea la nuova vista
    await client.query(`
      CREATE VIEW audit_logs_decompressed AS
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
    console.log('✅ Nuova vista creata');
    
    // Test
    const testResult = await client.query('SELECT COUNT(*) FROM audit_logs_decompressed');
    console.log(`✅ Vista funziona: ${testResult.rows[0].count} record`);
    
    // Test con dati di esempio
    const sampleResult = await client.query(`
      SELECT 
        id,
        action,
        resource,
        ip_address,
        user_agent,
        timestamp
      FROM audit_logs_decompressed
      LIMIT 3;
    `);
    
    console.log('\n📋 Esempi di dati decompressi:');
    sampleResult.rows.forEach((row, i) => {
      console.log(`   ${i+1}. Action: ${row.action}, Resource: ${row.resource}, IP: ${row.ip_address}`);
    });
    
  } finally {
    client.release();
    await pool.end();
  }
}

recreateView().catch(console.error);
