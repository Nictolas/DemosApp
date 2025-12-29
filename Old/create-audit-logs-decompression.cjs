// Creazione Viste Decompresse per audit_logs
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function createAuditLogsDecompression() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Creazione Viste Decompresse per audit_logs...\n');
    
    // 1. Verifica che audit_logs esista
    console.log('1. Verifica tabella audit_logs...');
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'audit_logs'
      );
    `);
    
    if (!tableExists.rows[0].exists) {
      console.log('❌ Tabella audit_logs non esiste. Creala prima.');
      return;
    }
    console.log('✅ Tabella audit_logs esiste');
    
    // 2. Analizza struttura audit_logs
    console.log('\n2. Analisi struttura audit_logs...');
    const structure = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'audit_logs' 
      ORDER BY ordinal_position;
    `);
    
    console.log('📊 Struttura audit_logs:');
    structure.rows.forEach(col => {
      console.log(`   • ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });
    
    // 3. Crea vista decompressa per audit_logs (se la tabella compressa esiste)
    console.log('\n3. Verifica e creazione vista audit_logs_decompressed...');
    try {
      const compressedTableExists = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'audit_logs_compressed'
        );
      `);
      
      if (compressedTableExists.rows[0].exists) {
        await client.query(`
          CREATE OR REPLACE VIEW audit_logs_decompressed AS
          SELECT 
            id,
            user_id,
            action,
            resource,
            resource_id,
            details,
            decompress_ip_address(ip_address) as ip_address,
            decompress_user_agent(user_agent) as user_agent,
            decompress_timestamp(timestamp) as timestamp,
            success,
            error_message
          FROM audit_logs_compressed;
        `);
        console.log('✅ Vista audit_logs_decompressed creata');
      } else {
        console.log('⚠️  Tabella audit_logs_compressed non esiste ancora');
        
        // Crea una vista che usa la tabella originale (per compatibilità)
        await client.query(`
          CREATE OR REPLACE VIEW audit_logs_decompressed AS
          SELECT 
            id,
            user_id,
            action,
            resource,
            resource_id,
            details,
            ip_address,
            user_agent,
            timestamp,
            success,
            error_message
          FROM audit_logs;
        `);
        console.log('✅ Vista audit_logs_decompressed creata (usa tabella originale)');
      }
    } catch (error) {
      console.log('⚠️  Errore creazione vista audit_logs_decompressed:', error.message);
    }
    
    // 4. Crea funzioni helper per audit_logs
    console.log('\n4. Creazione funzioni helper per audit_logs...');
    
    // Funzione per cercare audit logs per IP
    await client.query(`
      CREATE OR REPLACE FUNCTION find_audit_logs_by_ip(ip_text TEXT)
      RETURNS TABLE (
        id UUID,
        user_id VARCHAR(255),
        action VARCHAR(100),
        resource VARCHAR(100),
        resource_id VARCHAR(255),
        details JSONB,
        ip_address TEXT,
        user_agent TEXT,
        log_timestamp TIMESTAMP WITH TIME ZONE,
        success BOOLEAN,
        error_message TEXT
      ) AS $$
      BEGIN
        RETURN QUERY
        SELECT 
          al.id,
          al.user_id,
          al.action,
          al.resource,
          al.resource_id,
          al.details,
          al.ip_address,
          al.user_agent,
          al.timestamp as log_timestamp,
          al.success,
          al.error_message
        FROM audit_logs_decompressed al
        WHERE al.ip_address = ip_text
        ORDER BY al.timestamp DESC;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('✅ Funzione find_audit_logs_by_ip creata');
    
    // Funzione per cercare audit logs per user agent
    await client.query(`
      CREATE OR REPLACE FUNCTION find_audit_logs_by_user_agent(ua_text TEXT)
      RETURNS TABLE (
        id UUID,
        user_id VARCHAR(255),
        action VARCHAR(100),
        resource VARCHAR(100),
        resource_id VARCHAR(255),
        details JSONB,
        ip_address TEXT,
        user_agent TEXT,
        log_timestamp TIMESTAMP WITH TIME ZONE,
        success BOOLEAN,
        error_message TEXT
      ) AS $$
      BEGIN
        RETURN QUERY
        SELECT 
          al.id,
          al.user_id,
          al.action,
          al.resource,
          al.resource_id,
          al.details,
          al.ip_address,
          al.user_agent,
          al.timestamp as log_timestamp,
          al.success,
          al.error_message
        FROM audit_logs_decompressed al
        WHERE al.user_agent ILIKE '%' || ua_text || '%'
        ORDER BY al.timestamp DESC;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('✅ Funzione find_audit_logs_by_user_agent creata');
    
    // 5. Test delle funzioni
    console.log('\n5. Test delle funzioni...');
    
    // Test vista
    try {
      const viewTest = await client.query(`
        SELECT COUNT(*) as count 
        FROM audit_logs_decompressed 
        LIMIT 1;
      `);
      console.log(`✅ Vista audit_logs_decompressed funziona: ${viewTest.rows[0].count} record accessibili`);
    } catch (error) {
      console.log('⚠️  Vista audit_logs_decompressed non testabile:', error.message);
    }
    
    // Test funzione IP
    try {
      const ipTest = await client.query(`
        SELECT COUNT(*) as count 
        FROM find_audit_logs_by_ip('10.201.190.129');
      `);
      console.log(`✅ Funzione find_audit_logs_by_ip testata: ${ipTest.rows[0].count} record trovati`);
    } catch (error) {
      console.log('⚠️  Funzione find_audit_logs_by_ip non testabile:', error.message);
    }
    
    console.log('\n✅ Viste decompresse per audit_logs create con successo!');
    console.log('\n📋 Prossimi passi:');
    console.log('1. ✅ Viste decompresse create');
    console.log('2. ✅ Funzioni helper create');
    console.log('3. 🔄 Aggiornare security-metrics.js per usare le viste');
    console.log('4. 🔄 Testare le metriche di sicurezza');
    
  } catch (error) {
    console.error('❌ Errore creazione viste decompresse audit_logs:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Esegui se chiamato direttamente
if (require.main === module) {
  createAuditLogsDecompression()
    .then(() => {
      console.log('\n🎉 Viste decompresse audit_logs create con successo!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Errore creazione viste:', error);
      process.exit(1);
    });
}

module.exports = { createAuditLogsDecompression };
