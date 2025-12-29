// Test compressione IP CIDR
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function testIPCompression() {
  const client = await pool.connect();
  try {
    console.log('🧪 Test compressione IP CIDR...\n');
    
    const result = await client.query(`
      SELECT 
        '10.201.190.129/32' as original,
        compress_ip_address('10.201.190.129/32') as compressed,
        decompress_ip_address(compress_ip_address('10.201.190.129/32')) as decompressed;
    `);
    
    console.log('Test IP CIDR:', result.rows[0]);
    
    // Test IPv6
    const ipv6Result = await client.query(`
      SELECT 
        '::1/128' as original,
        compress_ip_address('::1/128') as compressed;
    `);
    
    console.log('Test IPv6:', ipv6Result.rows[0]);
    
  } finally {
    client.release();
    await pool.end();
  }
}

testIPCompression().catch(console.error);
