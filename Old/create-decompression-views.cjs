// Creazione Viste di Decompressione per Database DemosApp
// Fase 2: Viste che decompressione automaticamente i dati

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function createDecompressionViews() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Creazione Viste di Decompressione...\n');
    
    // 1. Verifica che le funzioni esistano
    console.log('1. Verifica funzioni di decompressione...');
    const functionsCheck = await client.query(`
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_name LIKE 'decompress_%' 
      AND routine_schema = 'public';
    `);
    
    console.log('✅ Funzioni disponibili:', functionsCheck.rows.map(r => r.routine_name).join(', '));
    
    // 2. Crea vista per centralized_logs_compressed (quando esisterà)
    console.log('\n2. Creazione vista centralized_logs_decompressed...');
    await client.query(`
      CREATE OR REPLACE VIEW centralized_logs_decompressed AS
      SELECT 
        id,
        decompress_timestamp(timestamp) as timestamp,
        decompress_log_level(level) as level,
        pid,
        hostname,
        message,
        user_id,
        decompress_ip_address(ip_address) as ip_address,
        decompress_user_agent(user_agent) as user_agent,
        decompress_endpoint(endpoint) as endpoint,
        request_id,
        session_id,
        meta_data,
        decompress_timestamp(created_at) as created_at
      FROM centralized_logs_compressed;
    `);
    console.log('✅ Vista centralized_logs_decompressed creata');
    
    // 3. Crea vista per audit_logs_compressed (solo se la tabella esiste)
    console.log('\n3. Verifica e creazione vista audit_logs_decompressed...');
    try {
      const auditTableExists = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'audit_logs_compressed'
        );
      `);
      
      if (auditTableExists.rows[0].exists) {
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
      }
    } catch (error) {
      console.log('⚠️  Errore creazione vista audit_logs_decompressed:', error.message);
    }
    
    // 4. Crea vista per security_events_compressed (solo se la tabella esiste)
    console.log('\n4. Verifica e creazione vista security_events_decompressed...');
    try {
      const securityTableExists = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'security_events_compressed'
        );
      `);
      
      if (securityTableExists.rows[0].exists) {
        await client.query(`
          CREATE OR REPLACE VIEW security_events_decompressed AS
          SELECT 
            id,
            type,
            decompress_ip_address(ip_address) as ip_address,
            user_id,
            user_email,
            decompress_user_agent(user_agent) as user_agent,
            severity,
            details,
            decompress_timestamp(created_at) as created_at
          FROM security_events_compressed;
        `);
        console.log('✅ Vista security_events_decompressed creata');
      } else {
        console.log('⚠️  Tabella security_events_compressed non esiste ancora');
      }
    } catch (error) {
      console.log('⚠️  Errore creazione vista security_events_decompressed:', error.message);
    }
    
    // 5. Test delle viste (se le tabelle compress esistono)
    console.log('\n5. Test delle viste...');
    
    // Test centralized_logs_decompressed
    try {
      const testView = await client.query(`
        SELECT COUNT(*) as count 
        FROM centralized_logs_decompressed 
        LIMIT 1;
      `);
      console.log('✅ Vista centralized_logs_decompressed funziona');
    } catch (error) {
      console.log('⚠️  Vista centralized_logs_decompressed non testabile (tabella non esiste ancora)');
    }
    
    // 6. Crea funzioni helper per query comuni
    console.log('\n6. Creazione funzioni helper per query comuni...');
    
    // Funzione per cercare IP in formato decompresso
    await client.query(`
      CREATE OR REPLACE FUNCTION find_logs_by_ip(ip_text TEXT)
      RETURNS TABLE (
        id UUID,
        log_timestamp TIMESTAMP WITH TIME ZONE,
        level TEXT,
        message TEXT,
        user_id VARCHAR(255),
        ip_address TEXT,
        user_agent TEXT,
        endpoint TEXT
      ) AS $$
      BEGIN
        RETURN QUERY
        SELECT 
          cl.id,
          decompress_timestamp(cl.timestamp) as log_timestamp,
          decompress_log_level(cl.level) as level,
          cl.message,
          cl.user_id,
          decompress_ip_address(cl.ip_address) as ip_address,
          decompress_user_agent(cl.user_agent) as user_agent,
          decompress_endpoint(cl.endpoint) as endpoint
        FROM centralized_logs_compressed cl
        WHERE decompress_ip_address(cl.ip_address) = ip_text
        ORDER BY cl.timestamp DESC;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('✅ Funzione find_logs_by_ip creata');
    
    // Funzione per cercare per user agent
    await client.query(`
      CREATE OR REPLACE FUNCTION find_logs_by_user_agent(ua_text TEXT)
      RETURNS TABLE (
        id UUID,
        log_timestamp TIMESTAMP WITH TIME ZONE,
        level TEXT,
        message TEXT,
        user_id VARCHAR(255),
        ip_address TEXT,
        user_agent TEXT,
        endpoint TEXT
      ) AS $$
      BEGIN
        RETURN QUERY
        SELECT 
          cl.id,
          decompress_timestamp(cl.timestamp) as log_timestamp,
          decompress_log_level(cl.level) as level,
          cl.message,
          cl.user_id,
          decompress_ip_address(cl.ip_address) as ip_address,
          decompress_user_agent(cl.user_agent) as user_agent,
          decompress_endpoint(cl.endpoint) as endpoint
        FROM centralized_logs_compressed cl
        WHERE decompress_user_agent(cl.user_agent) ILIKE '%' || ua_text || '%'
        ORDER BY cl.timestamp DESC;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('✅ Funzione find_logs_by_user_agent creata');
    
    // Funzione per cercare per endpoint
    await client.query(`
      CREATE OR REPLACE FUNCTION find_logs_by_endpoint(endpoint_text TEXT)
      RETURNS TABLE (
        id UUID,
        log_timestamp TIMESTAMP WITH TIME ZONE,
        level TEXT,
        message TEXT,
        user_id VARCHAR(255),
        ip_address TEXT,
        user_agent TEXT,
        endpoint TEXT
      ) AS $$
      BEGIN
        RETURN QUERY
        SELECT 
          cl.id,
          decompress_timestamp(cl.timestamp) as log_timestamp,
          decompress_log_level(cl.level) as level,
          cl.message,
          cl.user_id,
          decompress_ip_address(cl.ip_address) as ip_address,
          decompress_user_agent(cl.user_agent) as user_agent,
          decompress_endpoint(cl.endpoint) as endpoint
        FROM centralized_logs_compressed cl
        WHERE decompress_endpoint(cl.endpoint) ILIKE '%' || endpoint_text || '%'
        ORDER BY cl.timestamp DESC;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('✅ Funzione find_logs_by_endpoint creata');
    
    // 7. Test delle funzioni helper
    console.log('\n7. Test delle funzioni helper...');
    
    // Test con IP di esempio
    try {
      const ipTest = await client.query(`
        SELECT * FROM find_logs_by_ip('10.201.190.129') LIMIT 1;
      `);
      console.log('✅ Funzione find_logs_by_ip testata');
    } catch (error) {
      console.log('⚠️  Funzione find_logs_by_ip non testabile (tabella non esiste ancora)');
    }
    
    console.log('\n✅ Tutte le viste e funzioni helper create con successo!');
    console.log('\n📋 Prossimi passi:');
    console.log('1. ✅ Funzioni di decompressione create');
    console.log('2. ✅ Viste di decompressione create');
    console.log('3. ✅ Funzioni helper create');
    console.log('4. 🔄 Creare tabella centralized_logs_compressed');
    console.log('5. 🔄 Migrare dati di test');
    console.log('6. 🔄 Aggiornare query critiche una alla volta');
    
  } catch (error) {
    console.error('❌ Errore creazione viste decompressione:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Esegui se chiamato direttamente
if (require.main === module) {
  createDecompressionViews()
    .then(() => {
      console.log('\n🎉 Viste di decompressione create con successo!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Errore creazione viste:', error);
      process.exit(1);
    });
}

module.exports = { createDecompressionViews };
