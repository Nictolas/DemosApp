// Analisi IP addresses nella tabella centralized_logs
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function analyzeIPs() {
  const client = await pool.connect();
  try {
    console.log('📊 Analisi IP addresses in centralized_logs...\n');
    
    const result = await client.query(`
      SELECT 
        ip_address, 
        COUNT(*) as count,
        pg_typeof(ip_address) as data_type
      FROM centralized_logs 
      GROUP BY ip_address 
      ORDER BY count DESC 
      LIMIT 10;
    `);
    
    console.log('📋 Top 10 IP addresses:');
    result.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.ip_address} (${row.data_type}): ${row.count} record`);
    });
    
    // Analizza anche i valori NULL
    const nullResult = await client.query(`
      SELECT 
        COUNT(*) as null_count
      FROM centralized_logs 
      WHERE ip_address IS NULL;
    `);
    
    console.log(`\n📊 Record con IP NULL: ${nullResult.rows[0].null_count}`);
    
  } finally {
    client.release();
    await pool.end();
  }
}

analyzeIPs().catch(console.error);
