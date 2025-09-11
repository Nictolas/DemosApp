// File: create-rate-limit-table.cjs
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_oifPG6Kvz0UT@ep-withered-butterfly-a2mroznt-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

async function createRateLimitTable() {
  try {
    console.log('🔧 Creazione tabella rate_limit_violations...');

    const query = `
      CREATE TABLE IF NOT EXISTS rate_limit_violations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ip_address VARCHAR(45) NOT NULL,
        endpoint VARCHAR(255) NOT NULL,
        limit_type VARCHAR(50) NOT NULL,
        user_agent TEXT,
        user_id VARCHAR(255),
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Indici per performance
      CREATE INDEX IF NOT EXISTS idx_rate_limit_violations_ip 
        ON rate_limit_violations(ip_address);
      
      CREATE INDEX IF NOT EXISTS idx_rate_limit_violations_timestamp 
        ON rate_limit_violations(timestamp);
      
      CREATE INDEX IF NOT EXISTS idx_rate_limit_violations_limit_type 
        ON rate_limit_violations(limit_type);
      
      CREATE INDEX IF NOT EXISTS idx_rate_limit_violations_user_id 
        ON rate_limit_violations(user_id);
    `;

    await pool.query(query);
    console.log('✅ Tabella rate_limit_violations creata con successo!');
    console.log('📊 Indici creati per ottimizzare le query');

  } catch (error) {
    console.error('❌ Errore nella creazione tabella rate_limit_violations:', error);
  } finally {
    await pool.end();
  }
}

createRateLimitTable();
