// Analisi dettagliata formati IP nella tabella centralized_logs
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function analyzeIPFormatsDetailed() {
  const client = await pool.connect();
  try {
    console.log('📊 Analisi dettagliata formati IP in centralized_logs...\n');
    
    // 1. Analizza tutti i formati IP
    const result = await client.query(`
      SELECT 
        ip_address::TEXT as ip_text,
        COUNT(*) as count,
        pg_typeof(ip_address) as data_type
      FROM centralized_logs 
      WHERE ip_address IS NOT NULL
      GROUP BY ip_address::TEXT, pg_typeof(ip_address)
      ORDER BY count DESC 
      LIMIT 20;
    `);
    
    console.log('📋 Top 20 formati IP:');
    result.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. "${row.ip_text}" (${row.data_type}): ${row.count} record`);
    });
    
    // 2. Analizza IP con formato CIDR
    const cidrResult = await client.query(`
      SELECT 
        ip_address::TEXT as ip_text,
        COUNT(*) as count
      FROM centralized_logs 
      WHERE ip_address::TEXT LIKE '%/%'
      GROUP BY ip_address::TEXT
      ORDER BY count DESC;
    `);
    
    console.log(`\n🔍 IP con formato CIDR (${cidrResult.rows.length} tipi):`);
    cidrResult.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. "${row.ip_text}": ${row.count} record`);
    });
    
    // 3. Analizza IP senza formato CIDR
    const normalResult = await client.query(`
      SELECT 
        ip_address::TEXT as ip_text,
        COUNT(*) as count
      FROM centralized_logs 
      WHERE ip_address::TEXT NOT LIKE '%/%'
      GROUP BY ip_address::TEXT
      ORDER BY count DESC
      LIMIT 10;
    `);
    
    console.log(`\n✅ IP normali (${normalResult.rows.length} tipi):`);
    normalResult.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. "${row.ip_text}": ${row.count} record`);
    });
    
    // 4. Test di conversione
    console.log('\n🧪 Test di conversione IP:');
    
    // Test IP normale
    try {
      const normalIP = await client.query(`
        SELECT 
          ip_address::TEXT as original,
          split_part(ip_address::TEXT, '.', 1) as part1,
          split_part(ip_address::TEXT, '.', 2) as part2,
          split_part(ip_address::TEXT, '.', 3) as part3,
          split_part(ip_address::TEXT, '.', 4) as part4
        FROM centralized_logs 
        WHERE ip_address::TEXT NOT LIKE '%/%'
        LIMIT 1;
      `);
      
      if (normalIP.rows.length > 0) {
        const ip = normalIP.rows[0];
        console.log(`   IP normale: ${ip.original}`);
        console.log(`   Parti: ${ip.part1}.${ip.part2}.${ip.part3}.${ip.part4}`);
      }
    } catch (error) {
      console.log(`   ❌ Errore IP normale: ${error.message}`);
    }
    
    // Test IP CIDR
    try {
      const cidrIP = await client.query(`
        SELECT 
          ip_address::TEXT as original,
          split_part(ip_address::TEXT, '/', 1) as ip_part,
          split_part(ip_address::TEXT, '/', 2) as cidr_part
        FROM centralized_logs 
        WHERE ip_address::TEXT LIKE '%/%'
        LIMIT 1;
      `);
      
      if (cidrIP.rows.length > 0) {
        const ip = cidrIP.rows[0];
        console.log(`   IP CIDR: ${ip.original}`);
        console.log(`   IP parte: ${ip.ip_part}`);
        console.log(`   CIDR parte: ${ip.cidr_part}`);
      }
    } catch (error) {
      console.log(`   ❌ Errore IP CIDR: ${error.message}`);
    }
    
  } finally {
    client.release();
    await pool.end();
  }
}

analyzeIPFormatsDetailed().catch(console.error);
