const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function fixIPCompression() {
  const client = await pool.connect();
  try {
    console.log('🔧 Aggiornamento funzione compress_ip_address per gestire IP con x...');
    
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
        
        -- Skip IP con caratteri non numerici (es. "192.168.x.x")
        IF clean_ip ~ '[^0-9.]' THEN
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
    
    console.log('✅ Funzione compress_ip_address aggiornata');
    
    // Test della funzione aggiornata
    console.log('\n🧪 Test funzione aggiornata...');
    const testIPs = [
      '192.168.1.1',
      '10.201.190.129/32',
      '192.168.x.x',
      '::1',
      'unknown',
      null
    ];
    
    for (const ip of testIPs) {
      const result = await client.query('SELECT compress_ip_address($1) as compressed', [ip]);
      console.log(`   IP: "${ip}" → ${result.rows[0].compressed}`);
    }
    
  } finally {
    client.release();
    await pool.end();
  }
}

fixIPCompression().catch(console.error);
