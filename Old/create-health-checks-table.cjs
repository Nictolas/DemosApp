// File: create-health-checks-table.cjs
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function createHealthChecksTable() {
  try {
    console.log('🔧 Creazione tabella health_checks...');

    // Crea tabella health_checks
    await pool.query(`
      CREATE TABLE IF NOT EXISTS health_checks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(20) NOT NULL,
        checks JSONB NOT NULL,
        summary JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Crea indici per performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_health_checks_timestamp 
      ON health_checks (timestamp)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_health_checks_status 
      ON health_checks (status)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_health_checks_timestamp_status 
      ON health_checks (timestamp, status)
    `);

    console.log('✅ Tabella health_checks creata con successo!');
    console.log('📊 Indici creati per ottimizzazione performance');

  } catch (error) {
    console.error('❌ Errore creazione tabella health_checks:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Esegui se chiamato direttamente
if (require.main === module) {
  createHealthChecksTable()
    .then(() => {
      console.log('🎉 Setup health_checks completato!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Errore setup health_checks:', error);
      process.exit(1);
    });
}

module.exports = { createHealthChecksTable };
