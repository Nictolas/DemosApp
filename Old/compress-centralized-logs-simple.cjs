// Compressione Tabella centralized_logs - Versione Semplificata
// Implementazione graduale e sicura

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function compressCentralizedLogsSimple() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Compressione Tabella centralized_logs (Versione Semplificata)...\n');
    
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
        timestamp BIGINT NOT NULL,
        level CHAR(1) NOT NULL,
        pid INTEGER NOT NULL,
        hostname VARCHAR(50),
        message TEXT NOT NULL,
        user_id VARCHAR(255),
        ip_address INTEGER,
        user_agent VARCHAR(20),
        endpoint VARCHAR(100),
        request_id VARCHAR(255),
        session_id VARCHAR(255),
        meta_data JSONB,
        created_at BIGINT
      )
    `);
    
    // 5. Crea indici per performance
    console.log('5. Creazione indici per performance...');
    
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_centralized_logs_comp_timestamp ON centralized_logs_compressed (timestamp);',
      'CREATE INDEX IF NOT EXISTS idx_centralized_logs_comp_level ON centralized_logs_compressed (level);',
      'CREATE INDEX IF NOT EXISTS idx_centralized_logs_comp_user_id ON centralized_logs_compressed (user_id);',
      'CREATE INDEX IF NOT EXISTS idx_centralized_logs_comp_ip ON centralized_logs_compressed (ip_address);',
      'CREATE INDEX IF NOT EXISTS idx_centralized_logs_comp_endpoint ON centralized_logs_compressed (endpoint);'
    ];
    
    for (const indexQuery of indexes) {
      await client.query(indexQuery);
    }
    
    // 6. Test migrazione con un campione (senza funzioni complesse)
    console.log('6. Test migrazione con campione di 100 record...');
    
    const testMigration = await client.query(`
      INSERT INTO centralized_logs_compressed (
        id, timestamp, level, pid, hostname, message, user_id, 
        ip_address, user_agent, endpoint, request_id, session_id, 
        meta_data, created_at
      )
      SELECT 
        id,
        EXTRACT(EPOCH FROM timestamp)::BIGINT * 1000,
        CASE 
          WHEN level = 'INFO' THEN 'I'
          WHEN level = 'ERROR' THEN 'E'
          WHEN level = 'WARNING' THEN 'W'
          WHEN level = 'DEBUG' THEN 'D'
          WHEN level = 'TRACE' THEN 'T'
          ELSE LEFT(level, 1)
        END,
        pid,
        LEFT(hostname, 50),
        message,
        user_id,
        CASE 
          WHEN ip_address IS NULL OR ip_address = 'unknown' OR ip_address = '' THEN NULL
          ELSE (
            (split_part(ip_address, '.', 1)::INTEGER << 24) + 
            (split_part(ip_address, '.', 2)::INTEGER << 16) + 
            (split_part(ip_address, '.', 3)::INTEGER << 8) + 
            split_part(ip_address, '.', 4)::INTEGER
          )
        END,
        CASE 
          WHEN user_agent IS NULL OR user_agent = '' THEN 'UNK'
          WHEN user_agent ILIKE '%chrome%windows%' THEN 'CHR-WIN'
          WHEN user_agent ILIKE '%chrome%mac%' THEN 'CHR-MAC'
          WHEN user_agent ILIKE '%firefox%windows%' THEN 'FF-WIN'
          WHEN user_agent ILIKE '%safari%mac%' THEN 'SAF-MAC'
          WHEN user_agent ILIKE '%edge%windows%' THEN 'EDG-WIN'
          ELSE 'UNK'
        END,
        CASE 
          WHEN endpoint IS NULL OR endpoint = '' THEN NULL
          WHEN endpoint LIKE '/api/users/profile' THEN '/u/p'
          WHEN endpoint LIKE '/api/opinioni/create' THEN '/o/c'
          WHEN endpoint LIKE '/api/voti/capo-stato' THEN '/v/cs'
          WHEN endpoint LIKE '/api/auth/login' THEN '/a/l'
          ELSE LEFT(endpoint, 100)
        END,
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
    
    // 7. Analizza risparmio spazio
    console.log('7. Analisi risparmio spazio...');
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
    
    // 8. Calcola risparmio stimato
    const originalSize = parseInt(stats.current_size.replace(/[^\d]/g, ''));
    const compressedSize = parseInt(compressed.compressed_size.replace(/[^\d]/g, ''));
    const savings = ((originalSize - compressedSize) / originalSize) * 100;
    
    console.log(`\n🎯 Risparmio stimato:`);
    console.log(`   • Dimensione originale: ${stats.current_size}`);
    console.log(`   • Dimensione compressa: ${compressed.compressed_size}`);
    console.log(`   • Risparmio: ${savings.toFixed(1)}%`);
    
    // 9. Mostra esempi di compressione
    console.log('\n9. Esempi di compressione:');
    const examples = await client.query(`
      SELECT 
        cl.level as original_level,
        clc.level as compressed_level,
        cl.ip_address as original_ip,
        clc.ip_address as compressed_ip,
        cl.user_agent as original_ua,
        clc.user_agent as compressed_ua,
        cl.endpoint as original_endpoint,
        clc.endpoint as compressed_endpoint
      FROM centralized_logs cl
      JOIN centralized_logs_compressed clc ON cl.id = clc.id
      LIMIT 5;
    `);
    
    console.log('📋 Esempi di compressione:');
    examples.rows.forEach((row, index) => {
      console.log(`\n   Esempio ${index + 1}:`);
      console.log(`   • Level: ${row.original_level} → ${row.compressed_level}`);
      console.log(`   • IP: ${row.original_ip} → ${row.compressed_ip}`);
      console.log(`   • User Agent: ${row.original_ua?.substring(0, 50)}... → ${row.compressed_ua}`);
      console.log(`   • Endpoint: ${row.original_endpoint} → ${row.compressed_endpoint}`);
    });
    
    console.log('\n✅ Compressione centralized_logs completata con successo!');
    console.log('\n📋 Prossimi passi:');
    console.log('1. Verifica i dati compressi');
    console.log('2. Se tutto OK, procedi con migrazione completa');
    console.log('3. Aggiorna applicazione per usare tabella compressa');
    console.log('4. Procedi con la prossima tabella (audit_logs)');
    
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
  compressCentralizedLogsSimple()
    .then(() => {
      console.log('\n🎉 Compressione centralized_logs completata!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Errore compressione centralized_logs:', error);
      process.exit(1);
    });
}

module.exports = { compressCentralizedLogsSimple };
