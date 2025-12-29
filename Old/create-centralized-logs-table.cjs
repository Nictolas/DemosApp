// File: create-centralized-logs-table.cjs
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function createCentralizedLogsTable() {
  try {
    console.log('🔧 Creazione tabella centralized_logs...');

    // Crea tabella centralized_logs
    await pool.query(`
      CREATE TABLE IF NOT EXISTS centralized_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        level VARCHAR(10) NOT NULL,
        pid INTEGER NOT NULL,
        hostname VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        user_id VARCHAR(255),
        ip_address VARCHAR(45),
        user_agent TEXT,
        endpoint VARCHAR(500),
        request_id VARCHAR(255),
        session_id VARCHAR(255),
        meta_data JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Crea indici per performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_centralized_logs_timestamp 
      ON centralized_logs (timestamp)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_centralized_logs_level 
      ON centralized_logs (level)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_centralized_logs_user_id 
      ON centralized_logs (user_id)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_centralized_logs_endpoint 
      ON centralized_logs (endpoint)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_centralized_logs_ip_address 
      ON centralized_logs (ip_address)
    `);

    // Indice composito per query comuni
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_centralized_logs_level_timestamp 
      ON centralized_logs (level, timestamp)
    `);

    console.log('✅ Tabella centralized_logs creata con successo!');
    console.log('📊 Indici creati per ottimizzazione performance');

  } catch (error) {
    console.error('❌ Errore creazione tabella centralized_logs:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Esegui se chiamato direttamente
if (require.main === module) {
  createCentralizedLogsTable()
    .then(() => {
      console.log('🎉 Setup centralized_logs completato!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Errore setup centralized_logs:', error);
      process.exit(1);
    });
}

module.exports = { createCentralizedLogsTable };
