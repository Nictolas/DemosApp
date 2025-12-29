// Compressione Tabella centralized_logs - DemosApp
// Implementazione graduale e sicura

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function compressCentralizedLogs() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Compressione Tabella centralized_logs...\n');
    
    // 1. Verifica tabella esistente
    console.log('1. Verifica tabella centralized_logs esistente...');
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'centralized_logs'
      );
    `);
    
    if (!tableExists.rows[0].exists) {
      console.log('❌ Tabella centralized_logs non esiste. Creala prima.');
      return;
    }
    
    // 2. Analizza dati esistenti
    console.log('2. Analisi dati esistenti...');
    const analysis = await client.query(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(DISTINCT level) as unique_levels,
        COUNT(DISTINCT hostname) as unique_hostnames,
        COUNT(DISTINCT user_agent) as unique_user_agents,
        COUNT(DISTINCT endpoint) as unique_endpoints,
        pg_size_pretty(pg_total_relation_size('centralized_logs')) as current_size
      FROM centralized_logs;
    `);
    
    const stats = analysis.rows[0];
    console.log(`📊 Statistiche attuali:`);
    console.log(`   • Record totali: ${stats.total_records}`);
    console.log(`   • Livelli unici: ${stats.unique_levels}`);
    console.log(`   • Hostname unici: ${stats.unique_hostnames}`);
    console.log(`   • User Agent unici: ${stats.unique_user_agents}`);
    console.log(`   • Endpoint unici: ${stats.unique_endpoints}`);
    console.log(`   • Dimensione attuale: ${stats.current_size}`);
    
    // 3. Analizza distribuzione livelli
    console.log('\n3. Analisi distribuzione livelli...');
    const levelDistribution = await client.query(`
      SELECT level, COUNT(*) as count
      FROM centralized_logs
      GROUP BY level
      ORDER BY count DESC;
    `);
    
    console.log('📈 Distribuzione livelli:');
    levelDistribution.rows.forEach(row => {
      console.log(`   • ${row.level}: ${row.count} record`);
    });
    
    // 4. Crea tabella compressa
    console.log('\n4. Creazione tabella centralized_logs_compressed...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS centralized_logs_compressed (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        timestamp BIGINT NOT NULL, -- Unix timestamp invece di TIMESTAMP
        level CHAR(1) NOT NULL, -- 'I', 'E', 'W', 'D', 'T' invece di 'INFO', 'ERROR', etc.
        pid INTEGER NOT NULL,
        hostname VARCHAR(50), -- Ridotto da 255
        message TEXT NOT NULL,
        user_id VARCHAR(255),
        ip_address INTEGER, -- IPv4 come integer invece di VARCHAR(45)
        user_agent VARCHAR(20), -- Compresso invece di TEXT
        endpoint VARCHAR(100), -- Compresso invece di VARCHAR(500)
        request_id VARCHAR(255),
        session_id VARCHAR(255),
        meta_data JSONB,
        created_at BIGINT -- Unix timestamp invece di TIMESTAMP
      )
    `);
    
    // 5. Crea funzioni di compressione
    console.log('5. Creazione funzioni di compressione...');
    
    await client.query(`
      CREATE OR REPLACE FUNCTION compress_log_level(level_text TEXT)
      RETURNS CHAR(1) AS $$
      BEGIN
        CASE level_text
          WHEN 'INFO' THEN RETURN 'I';
          WHEN 'ERROR' THEN RETURN 'E';
          WHEN 'WARNING' THEN RETURN 'W';
          WHEN 'DEBUG' THEN RETURN 'D';
          WHEN 'TRACE' THEN RETURN 'T';
          ELSE RETURN COALESCE(LEFT(level_text, 1), 'U');
        END CASE;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    await client.query(`
      CREATE OR REPLACE FUNCTION compress_ip_address(ip_text TEXT)
      RETURNS INTEGER AS $$
      DECLARE
        parts TEXT[];
      BEGIN
        IF ip_text IS NULL OR ip_text = 'unknown' OR ip_text = '' THEN
          RETURN NULL;
        END IF;
        
        parts := string_to_array(ip_text, '.');
        IF array_length(parts, 1) != 4 THEN
          RETURN NULL;
        END IF;
        
        RETURN (parts[1]::INTEGER << 24) + 
               (parts[2]::INTEGER << 16) + 
               (parts[3]::INTEGER << 8) + 
               parts[4]::INTEGER;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    await client.query(`
      CREATE OR REPLACE FUNCTION compress_user_agent(ua_text TEXT)
      RETURNS VARCHAR(20) AS $$
      BEGIN
        IF ua_text IS NULL OR ua_text = '' THEN
          RETURN 'UNK';
        END IF;
        
        IF ua_text ILIKE '%chrome%windows%' THEN RETURN 'CHR-WIN';
        IF ua_text ILIKE '%chrome%mac%' THEN RETURN 'CHR-MAC';
        IF ua_text ILIKE '%chrome%linux%' THEN RETURN 'CHR-LIN';
        IF ua_text ILIKE '%firefox%windows%' THEN RETURN 'FF-WIN';
        IF ua_text ILIKE '%firefox%mac%' THEN RETURN 'FF-MAC';
        IF ua_text ILIKE '%firefox%linux%' THEN RETURN 'FF-LIN';
        IF ua_text ILIKE '%safari%mac%' THEN RETURN 'SAF-MAC';
        IF ua_text ILIKE '%safari%iphone%' THEN RETURN 'SAF-IOS';
        IF ua_text ILIKE '%edge%windows%' THEN RETURN 'EDG-WIN';
        IF ua_text ILIKE '%opera%windows%' THEN RETURN 'OPR-WIN';
        IF ua_text ILIKE '%mobile%chrome%' THEN RETURN 'MOB-CHR';
        IF ua_text ILIKE '%mobile%safari%' THEN RETURN 'MOB-SAF';
        IF ua_text ILIKE '%googlebot%' THEN RETURN 'BOT-GGL';
        IF ua_text ILIKE '%bingbot%' THEN RETURN 'BOT-BNG';
        
        RETURN 'UNK';
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    await client.query(`
      CREATE OR REPLACE FUNCTION compress_endpoint(endpoint_text TEXT)
      RETURNS VARCHAR(100) AS $$
      BEGIN
        IF endpoint_text IS NULL OR endpoint_text = '' THEN
          RETURN NULL;
        END IF;
        
        -- Compressione endpoint comuni
        IF endpoint_text LIKE '/api/users/profile' THEN RETURN '/u/p';
        IF endpoint_text LIKE '/api/users/update' THEN RETURN '/u/u';
        IF endpoint_text LIKE '/api/opinioni/create' THEN RETURN '/o/c';
        IF endpoint_text LIKE '/api/opinioni/update' THEN RETURN '/o/u';
        IF endpoint_text LIKE '/api/comunicazioni/create' THEN RETURN '/c/c';
        IF endpoint_text LIKE '/api/voti/capo-stato' THEN RETURN '/v/cs';
        IF endpoint_text LIKE '/api/voti/iniziative-popolari' THEN RETURN '/v/ip';
        IF endpoint_text LIKE '/api/voti/ice' THEN RETURN '/v/ice';
        IF endpoint_text LIKE '/api/voti/referendum' THEN RETURN '/v/r';
        IF endpoint_text LIKE '/api/notifiche' THEN RETURN '/n';
        IF endpoint_text LIKE '/api/auth/login' THEN RETURN '/a/l';
        IF endpoint_text LIKE '/api/auth/logout' THEN RETURN '/a/lo';
        IF endpoint_text LIKE '/api/admin/users' THEN RETURN '/ad/u';
        IF endpoint_text LIKE '/api/admin/security' THEN RETURN '/ad/s';
        
        -- Per altri endpoint, tronca a 100 caratteri
        RETURN LEFT(endpoint_text, 100);
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    // 6. Crea indici per performance
    console.log('6. Creazione indici per performance...');
    
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_centralized_logs_comp_timestamp ON centralized_logs_compressed (timestamp);',
      'CREATE INDEX IF NOT EXISTS idx_centralized_logs_comp_level ON centralized_logs_compressed (level);',
      'CREATE INDEX IF NOT EXISTS idx_centralized_logs_comp_user_id ON centralized_logs_compressed (user_id);',
      'CREATE INDEX IF NOT EXISTS idx_centralized_logs_comp_ip ON centralized_logs_compressed (ip_address);',
      'CREATE INDEX IF NOT EXISTS idx_centralized_logs_comp_endpoint ON centralized_logs_compressed (endpoint);',
      'CREATE INDEX IF NOT EXISTS idx_centralized_logs_comp_level_timestamp ON centralized_logs_compressed (level, timestamp);'
    ];
    
    for (const indexQuery of indexes) {
      await client.query(indexQuery);
    }
    
    // 7. Test migrazione con un campione
    console.log('7. Test migrazione con campione di 100 record...');
    
    const testMigration = await client.query(`
      INSERT INTO centralized_logs_compressed (
        id, timestamp, level, pid, hostname, message, user_id, 
        ip_address, user_agent, endpoint, request_id, session_id, 
        meta_data, created_at
      )
      SELECT 
        id,
        EXTRACT(EPOCH FROM timestamp)::BIGINT * 1000,
        compress_log_level(level),
        pid,
        LEFT(hostname, 50),
        message,
        user_id,
        compress_ip_address(ip_address),
        compress_user_agent(user_agent),
        compress_endpoint(endpoint),
        request_id,
        session_id,
        meta_data,
        EXTRACT(EPOCH FROM created_at)::BIGINT * 1000
      FROM centralized_logs
      WHERE NOT EXISTS (
        SELECT 1 FROM centralized_logs_compressed 
        WHERE centralized_logs_compressed.id = centralized_logs.id
      )
      LIMIT 100;
    `);
    
    console.log(`✅ Test migrazione completato: ${testMigration.rowCount} record migrati`);
    
    // 8. Analizza risparmio spazio
    console.log('8. Analisi risparmio spazio...');
    const compressedStats = await client.query(`
      SELECT 
        COUNT(*) as compressed_records,
        pg_size_pretty(pg_total_relation_size('centralized_logs_compressed')) as compressed_size
      FROM centralized_logs_compressed;
    `);
    
    const compressed = compressedStats.rows[0];
    console.log(`📊 Statistiche tabella compressa:`);
    console.log(`   • Record compressi: ${compressed.compressed_records}`);
    console.log(`   • Dimensione compressa: ${compressed.compressed_size}`);
    
    // 9. Calcola risparmio stimato
    const originalSize = parseInt(stats.current_size.replace(/[^\d]/g, ''));
    const compressedSize = parseInt(compressed.compressed_size.replace(/[^\d]/g, ''));
    const savings = ((originalSize - compressedSize) / originalSize) * 100;
    
    console.log(`\n🎯 Risparmio stimato:`);
    console.log(`   • Dimensione originale: ${stats.current_size}`);
    console.log(`   • Dimensione compressa: ${compressed.compressed_size}`);
    console.log(`   • Risparmio: ${savings.toFixed(1)}%`);
    
    console.log('\n✅ Compressione centralized_logs completata con successo!');
    console.log('\n📋 Prossimi passi:');
    console.log('1. Verifica i dati compressi');
    console.log('2. Testa le funzioni di decompressione');
    console.log('3. Se tutto OK, procedi con migrazione completa');
    console.log('4. Aggiorna applicazione per usare tabella compressa');
    
  } catch (error) {
    console.error('❌ Errore compressione centralized_logs:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Esegui se chiamato direttamente
if (require.main === module) {
  compressCentralizedLogs()
    .then(() => {
      console.log('\n🎉 Compressione centralized_logs completata!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Errore compressione centralized_logs:', error);
      process.exit(1);
    });
}

module.exports = { compressCentralizedLogs };
