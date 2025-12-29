// Creazione Tabella Compressa e Migrazione Dati di Test
// Fase 3: Creare centralized_logs_compressed e migrare un campione

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function createCompressedTableAndMigrate() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Creazione Tabella Compressa e Migrazione Dati di Test...\n');
    
    // 1. Verifica tabella originale
    console.log('1. Verifica tabella centralized_logs originale...');
    const originalStats = await client.query(`
      SELECT 
        COUNT(*) as total_records,
        pg_size_pretty(pg_total_relation_size('centralized_logs')) as original_size
      FROM centralized_logs;
    `);
    
    const stats = originalStats.rows[0];
    console.log(`📊 Tabella originale:`);
    console.log(`   • Record totali: ${stats.total_records}`);
    console.log(`   • Dimensione: ${stats.original_size}`);
    
    // 2. Crea tabella compressa
    console.log('\n2. Creazione tabella centralized_logs_compressed...');
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
    console.log('✅ Tabella centralized_logs_compressed creata');
    
    // 3. Crea indici per performance
    console.log('\n3. Creazione indici per performance...');
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
    console.log('✅ Indici creati');
    
    // 4. Migrazione di test con 1000 record
    console.log('\n4. Migrazione di test con 1000 record...');
    
    const migrationResult = await client.query(`
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
        compress_ip_address(ip_address::TEXT),
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
      ORDER BY timestamp DESC
      LIMIT 1000;
    `);
    
    console.log(`✅ Migrazione completata: ${migrationResult.rowCount} record migrati`);
    
    // 5. Analisi risparmio spazio
    console.log('\n5. Analisi risparmio spazio...');
    const compressedStats = await client.query(`
      SELECT 
        COUNT(*) as compressed_records,
        pg_size_pretty(pg_total_relation_size('centralized_logs_compressed')) as compressed_size
      FROM centralized_logs_compressed;
    `);
    
    const compressed = compressedStats.rows[0];
    console.log(`📊 Tabella compressa:`);
    console.log(`   • Record compressi: ${compressed.compressed_records}`);
    console.log(`   • Dimensione: ${compressed.compressed_size}`);
    
    // 6. Calcola risparmio stimato
    const originalSize = parseInt(stats.original_size.replace(/[^\d]/g, ''));
    const compressedSize = parseInt(compressed.compressed_size.replace(/[^\d]/g, ''));
    const savings = ((originalSize - compressedSize) / originalSize) * 100;
    
    console.log(`\n🎯 Risparmio stimato per 1000 record:`);
    console.log(`   • Dimensione originale: ${stats.original_size}`);
    console.log(`   • Dimensione compressa: ${compressed.compressed_size}`);
    console.log(`   • Risparmio: ${savings.toFixed(1)}%`);
    
    // 7. Test delle viste di decompressione
    console.log('\n7. Test delle viste di decompressione...');
    
    const viewTest = await client.query(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(DISTINCT ip_address) as unique_ips,
        COUNT(DISTINCT user_agent) as unique_user_agents,
        COUNT(DISTINCT endpoint) as unique_endpoints
      FROM centralized_logs_decompressed;
    `);
    
    const viewStats = viewTest.rows[0];
    console.log(`📊 Vista decompressa:`);
    console.log(`   • Record totali: ${viewStats.total_records}`);
    console.log(`   • IP unici: ${viewStats.unique_ips}`);
    console.log(`   • User Agent unici: ${viewStats.unique_user_agents}`);
    console.log(`   • Endpoint unici: ${viewStats.unique_endpoints}`);
    
    // 8. Test delle funzioni helper
    console.log('\n8. Test delle funzioni helper...');
    
    // Test ricerca per IP
    const ipSearchTest = await client.query(`
      SELECT COUNT(*) as count 
      FROM find_logs_by_ip('10.201.190.129');
    `);
    console.log(`🔍 Test ricerca IP: ${ipSearchTest.rows[0].count} record trovati`);
    
    // Test ricerca per user agent
    const uaSearchTest = await client.query(`
      SELECT COUNT(*) as count 
      FROM find_logs_by_user_agent('Chrome');
    `);
    console.log(`🔍 Test ricerca User Agent: ${uaSearchTest.rows[0].count} record trovati`);
    
    // 9. Esempi di compressione
    console.log('\n9. Esempi di compressione:');
    const examples = await client.query(`
      SELECT 
        cl.level as original_level,
        clc.level as compressed_level,
        cl.ip_address::TEXT as original_ip,
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
    
    console.log('\n✅ Tabella compressa creata e migrazione di test completata!');
    console.log('\n📋 Prossimi passi:');
    console.log('1. ✅ Funzioni di decompressione create');
    console.log('2. ✅ Viste di decompressione create');
    console.log('3. ✅ Tabella compressa creata');
    console.log('4. ✅ Migrazione di test completata');
    console.log('5. 🔄 Aggiornare query critiche una alla volta');
    console.log('6. 🔄 Testare ogni modifica');
    console.log('7. 🔄 Migrazione completa (se tutto OK)');
    
  } catch (error) {
    console.error('❌ Errore creazione tabella compressa:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Esegui se chiamato direttamente
if (require.main === module) {
  createCompressedTableAndMigrate()
    .then(() => {
      console.log('\n🎉 Tabella compressa creata e migrazione completata!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Errore creazione tabella:', error);
      process.exit(1);
    });
}

module.exports = { createCompressedTableAndMigrate };
