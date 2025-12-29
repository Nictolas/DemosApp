// Creazione Funzioni di Decompressione per Database DemosApp
// Fase 1: Funzioni sicure per decompressione dati

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function createDecompressionFunctions() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Creazione Funzioni di Decompressione...\n');
    
    // 1. Funzione per decompressione IP (integer -> string)
    console.log('1. Creazione funzione decompress_ip_address...');
    await client.query(`
      CREATE OR REPLACE FUNCTION decompress_ip_address(ip_int INTEGER)
      RETURNS TEXT AS $$
      BEGIN
        IF ip_int IS NULL THEN
          RETURN NULL;
        END IF;
        
        RETURN (
          ((ip_int >> 24) & 255)::TEXT || '.' ||
          ((ip_int >> 16) & 255)::TEXT || '.' ||
          ((ip_int >> 8) & 255)::TEXT || '.' ||
          (ip_int & 255)::TEXT
        );
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('✅ Funzione decompress_ip_address creata');
    
    // 2. Funzione per compressione IP (string -> integer) - per test
    console.log('2. Creazione funzione compress_ip_address...');
    await client.query(`
      CREATE OR REPLACE FUNCTION compress_ip_address(ip_text TEXT)
      RETURNS INTEGER AS $$
      DECLARE
        parts TEXT[];
        clean_ip TEXT;
      BEGIN
        IF ip_text IS NULL OR ip_text = 'unknown' OR ip_text = '' THEN
          RETURN NULL;
        END IF;
        
        -- Gestisce formato CIDR (es. "192.168.1.1/32") e IPv6 (es. "::1/128")
        IF ip_text LIKE '%/%' THEN
          clean_ip := split_part(ip_text, '/', 1);
        ELSE
          clean_ip := ip_text;
        END IF;
        
        -- Skip IPv6 per ora
        IF clean_ip LIKE '::%' THEN
          RETURN NULL;
        END IF;
        
        parts := string_to_array(clean_ip, '.');
        IF array_length(parts, 1) != 4 THEN
          RETURN NULL;
        END IF;
        
        RETURN (
          (parts[1]::INTEGER << 24) + 
          (parts[2]::INTEGER << 16) + 
          (parts[3]::INTEGER << 8) + 
          parts[4]::INTEGER
        );
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('✅ Funzione compress_ip_address creata');
    
    // 3. Funzione per decompressione log level
    console.log('3. Creazione funzione decompress_log_level...');
    await client.query(`
      CREATE OR REPLACE FUNCTION decompress_log_level(level_char CHAR(1))
      RETURNS TEXT AS $$
      BEGIN
        CASE level_char
          WHEN 'I' THEN RETURN 'INFO';
          WHEN 'E' THEN RETURN 'ERROR';
          WHEN 'W' THEN RETURN 'WARNING';
          WHEN 'D' THEN RETURN 'DEBUG';
          WHEN 'T' THEN RETURN 'TRACE';
          ELSE RETURN level_char::TEXT;
        END CASE;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('✅ Funzione decompress_log_level creata');
    
    // 4. Funzione per decompressione user agent
    console.log('4. Creazione funzione decompress_user_agent...');
    await client.query(`
      CREATE OR REPLACE FUNCTION decompress_user_agent(ua_code VARCHAR(20))
      RETURNS TEXT AS $$
      BEGIN
        CASE ua_code
          WHEN 'CHR-WIN' THEN RETURN 'Chrome-Windows';
          WHEN 'CHR-MAC' THEN RETURN 'Chrome-Mac';
          WHEN 'CHR-LIN' THEN RETURN 'Chrome-Linux';
          WHEN 'FF-WIN' THEN RETURN 'Firefox-Windows';
          WHEN 'FF-MAC' THEN RETURN 'Firefox-Mac';
          WHEN 'FF-LIN' THEN RETURN 'Firefox-Linux';
          WHEN 'SAF-MAC' THEN RETURN 'Safari-Mac';
          WHEN 'SAF-IOS' THEN RETURN 'Safari-iOS';
          WHEN 'EDG-WIN' THEN RETURN 'Edge-Windows';
          WHEN 'OPR-WIN' THEN RETURN 'Opera-Windows';
          WHEN 'MOB-CHR' THEN RETURN 'Mobile-Chrome';
          WHEN 'MOB-SAF' THEN RETURN 'Mobile-Safari';
          WHEN 'BOT-GGL' THEN RETURN 'GoogleBot';
          WHEN 'BOT-BNG' THEN RETURN 'BingBot';
          WHEN 'UNK' THEN RETURN 'Unknown';
          ELSE RETURN COALESCE(ua_code, 'Unknown');
        END CASE;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('✅ Funzione decompress_user_agent creata');
    
    // 5. Funzione per decompressione endpoint
    console.log('5. Creazione funzione decompress_endpoint...');
    await client.query(`
      CREATE OR REPLACE FUNCTION decompress_endpoint(endpoint_code VARCHAR(100))
      RETURNS TEXT AS $$
      BEGIN
        CASE endpoint_code
          WHEN '/u/p' THEN RETURN '/api/users/profile';
          WHEN '/u/u' THEN RETURN '/api/users/update';
          WHEN '/o/c' THEN RETURN '/api/opinioni/create';
          WHEN '/o/u' THEN RETURN '/api/opinioni/update';
          WHEN '/c/c' THEN RETURN '/api/comunicazioni/create';
          WHEN '/v/cs' THEN RETURN '/api/voti/capo-stato';
          WHEN '/v/ip' THEN RETURN '/api/voti/iniziative-popolari';
          WHEN '/v/ice' THEN RETURN '/api/voti/ice';
          WHEN '/v/r' THEN RETURN '/api/voti/referendum';
          WHEN '/n' THEN RETURN '/api/notifiche';
          WHEN '/a/l' THEN RETURN '/api/auth/login';
          WHEN '/a/lo' THEN RETURN '/api/auth/logout';
          WHEN '/ad/u' THEN RETURN '/api/admin/users';
          WHEN '/ad/s' THEN RETURN '/api/admin/security';
          ELSE RETURN COALESCE(endpoint_code, NULL);
        END CASE;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('✅ Funzione decompress_endpoint creata');
    
    // 6. Funzione per decompressione timestamp
    console.log('6. Creazione funzione decompress_timestamp...');
    await client.query(`
      CREATE OR REPLACE FUNCTION decompress_timestamp(timestamp_bigint BIGINT)
      RETURNS TIMESTAMP WITH TIME ZONE AS $$
      BEGIN
        IF timestamp_bigint IS NULL THEN
          RETURN NULL;
        END IF;
        
        RETURN to_timestamp(timestamp_bigint / 1000.0);
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('✅ Funzione decompress_timestamp creata');
    
    // 7. Test delle funzioni
    console.log('\n7. Test delle funzioni di decompressione...');
    
    // Test IP
    const ipTest = await client.query(`
      SELECT 
        compress_ip_address('10.201.190.129') as compressed,
        decompress_ip_address(compress_ip_address('10.201.190.129')) as decompressed;
    `);
    console.log('🔍 Test IP:', ipTest.rows[0]);
    
    // Test log level
    const levelTest = await client.query(`
      SELECT 
        decompress_log_level('I') as info,
        decompress_log_level('W') as warning,
        decompress_log_level('E') as error;
    `);
    console.log('🔍 Test Log Level:', levelTest.rows[0]);
    
    // Test user agent
    const uaTest = await client.query(`
      SELECT 
        decompress_user_agent('CHR-WIN') as chrome_windows,
        decompress_user_agent('FF-MAC') as firefox_mac,
        decompress_user_agent('UNK') as unknown;
    `);
    console.log('🔍 Test User Agent:', uaTest.rows[0]);
    
    // Test endpoint
    const endpointTest = await client.query(`
      SELECT 
        decompress_endpoint('/u/p') as user_profile,
        decompress_endpoint('/v/cs') as capo_stato,
        decompress_endpoint('/a/l') as auth_login;
    `);
    console.log('🔍 Test Endpoint:', endpointTest.rows[0]);
    
    // Test timestamp
    const timestampTest = await client.query(`
      SELECT 
        decompress_timestamp(1729008625123) as timestamp;
    `);
    console.log('🔍 Test Timestamp:', timestampTest.rows[0]);
    
    console.log('\n✅ Tutte le funzioni di decompressione create e testate con successo!');
    console.log('\n📋 Prossimi passi:');
    console.log('1. ✅ Funzioni di decompressione create');
    console.log('2. 🔄 Creare viste di decompressione per centralized_logs');
    console.log('3. 🔄 Aggiornare query critiche una alla volta');
    console.log('4. 🔄 Testare ogni modifica');
    
  } catch (error) {
    console.error('❌ Errore creazione funzioni decompressione:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Esegui se chiamato direttamente
if (require.main === module) {
  createDecompressionFunctions()
    .then(() => {
      console.log('\n🎉 Funzioni di decompressione create con successo!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Errore creazione funzioni:', error);
      process.exit(1);
    });
}

module.exports = { createDecompressionFunctions };
