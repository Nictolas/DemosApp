// File: create-validation-table.cjs
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:[REDACTED_NEON_PASSWORD]@ep-withered-butterfly-a2mroznt-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

async function createValidationTable() {
  try {
    console.log('🔧 Creazione tabella validation_failures...');

    const query = `
      CREATE TABLE IF NOT EXISTS validation_failures (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ip_address VARCHAR(45) NOT NULL,
        user_agent TEXT,
        endpoint VARCHAR(255) NOT NULL,
        errors JSONB NOT NULL,
        input_data JSONB,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Indici per performance
      CREATE INDEX IF NOT EXISTS idx_validation_failures_ip 
        ON validation_failures(ip_address);
      
      CREATE INDEX IF NOT EXISTS idx_validation_failures_timestamp 
        ON validation_failures(timestamp);
      
      CREATE INDEX IF NOT EXISTS idx_validation_failures_endpoint 
        ON validation_failures(endpoint);
      
      CREATE INDEX IF NOT EXISTS idx_validation_failures_errors 
        ON validation_failures USING GIN(errors);
    `;

    await pool.query(query);
    console.log('✅ Tabella validation_failures creata con successo!');
    console.log('📊 Indici creati per ottimizzare le query');

  } catch (error) {
    console.error('❌ Errore nella creazione tabella validation_failures:', error);
  } finally {
    await pool.end();
  }
}

createValidationTable();
