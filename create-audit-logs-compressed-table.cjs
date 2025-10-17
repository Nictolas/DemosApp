const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function createAuditLogsCompressedTable() {
  const client = await pool.connect();
  try {
    console.log('🔧 Creazione tabella audit_logs_compressed...');

    // 1. Crea la tabella compressa
    console.log('\n1. Creazione struttura tabella...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs_compressed (
        id UUID PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        action VARCHAR(3) NOT NULL, -- Compresso (es. 'DA' per DATA_ACCESS)
        resource VARCHAR(10) NOT NULL, -- Compresso (es. 'usr' per users)
        resource_id VARCHAR(255),
        details JSONB,
        ip_address INTEGER, -- Compresso (IP come integer)
        user_agent VARCHAR(20), -- Compresso (es. 'CHR-WIN')
        timestamp BIGINT, -- Compresso (Unix timestamp in millisecondi)
        success BOOLEAN,
        error_message TEXT,
        created_at BIGINT -- Compresso (Unix timestamp in millisecondi)
      );
    `);
    console.log('   ✅ Tabella audit_logs_compressed creata');

    // 2. Crea indici per performance
    console.log('\n2. Creazione indici...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_compressed_user_id ON audit_logs_compressed(user_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_compressed_action ON audit_logs_compressed(action);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_compressed_timestamp ON audit_logs_compressed(timestamp);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_compressed_ip ON audit_logs_compressed(ip_address);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_compressed_created_at ON audit_logs_compressed(created_at);
    `);
    console.log('   ✅ Indici creati');

    // 3. Migra i dati esistenti
    console.log('\n3. Migrazione dati esistenti...');
    const migrationResult = await client.query(`
      INSERT INTO audit_logs_compressed (
        id, user_id, action, resource, resource_id, details,
        ip_address, user_agent, timestamp, success, error_message, created_at
      )
      SELECT 
        id,
        user_id,
        compress_audit_action(action),
        compress_audit_resource(resource),
        resource_id,
        details,
        compress_ip_address(ip_address),
        compress_audit_user_agent(user_agent),
        EXTRACT(EPOCH FROM timestamp) * 1000, -- Converti in millisecondi
        success,
        error_message,
        EXTRACT(EPOCH FROM created_at) * 1000 -- Converti in millisecondi
      FROM audit_logs
      ORDER BY timestamp DESC;
    `);
    
    console.log(`   ✅ ${migrationResult.rowCount} record migrati`);

    // 4. Verifica la migrazione
    console.log('\n4. Verifica migrazione...');
    const originalCount = await client.query('SELECT COUNT(*) FROM audit_logs');
    const compressedCount = await client.query('SELECT COUNT(*) FROM audit_logs_compressed');
    
    console.log(`   • Record originali: ${originalCount.rows[0].count}`);
    console.log(`   • Record compressi: ${compressedCount.rows[0].count}`);
    
    if (originalCount.rows[0].count === compressedCount.rows[0].count) {
      console.log('   ✅ Migrazione completata con successo!');
    } else {
      console.log('   ⚠️ Attenzione: Numero di record non corrisponde');
    }

    // 5. Test delle funzioni di decompressione
    console.log('\n5. Test funzioni di decompressione...');
    const testResult = await client.query(`
      SELECT 
        id,
        user_id,
        decompress_audit_action(action) as action_decompressed,
        decompress_audit_resource(resource) as resource_decompressed,
        decompress_ip_address(ip_address) as ip_decompressed,
        decompress_audit_user_agent(user_agent) as user_agent_decompressed,
        to_timestamp(timestamp / 1000) as timestamp_decompressed
      FROM audit_logs_compressed
      LIMIT 3;
    `);
    
    console.log('   Esempi di decompressione:');
    testResult.rows.forEach((row, i) => {
      console.log(`   ${i+1}. ID: ${row.id.substring(0, 8)}...`);
      console.log(`      Action: ${row.action_decompressed}`);
      console.log(`      Resource: ${row.resource_decompressed}`);
      console.log(`      IP: ${row.ip_decompressed}`);
      console.log(`      User Agent: ${row.user_agent_decompressed}`);
      console.log(`      Timestamp: ${row.timestamp_decompressed}`);
    });

    console.log('\n✅ Tabella audit_logs_compressed creata e popolata con successo!');

  } finally {
    client.release();
    await pool.end();
  }
}

createAuditLogsCompressedTable().catch(console.error);
