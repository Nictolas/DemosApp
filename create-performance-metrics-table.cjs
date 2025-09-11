// File: create-performance-metrics-table.cjs
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function createPerformanceMetricsTable() {
  try {
    console.log('🔧 Creazione tabella performance_metrics...');

    // Crea tabella performance_metrics
    await pool.query(`
      CREATE TABLE IF NOT EXISTS performance_metrics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        cpu_usage DECIMAL(5,2),
        memory_usage BIGINT,
        memory_total BIGINT,
        memory_free BIGINT,
        db_connections INTEGER,
        db_size_bytes BIGINT,
        error_count INTEGER DEFAULT 0,
        warning_count INTEGER DEFAULT 0,
        event_loop_delay DECIMAL(10,2),
        uptime DECIMAL(10,2),
        load_average JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Crea indici per performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_performance_metrics_timestamp 
      ON performance_metrics (timestamp)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_performance_metrics_cpu_usage 
      ON performance_metrics (cpu_usage)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_performance_metrics_memory_usage 
      ON performance_metrics (memory_usage)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_performance_metrics_error_count 
      ON performance_metrics (error_count)
    `);

    // Indice composito per query temporali
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_performance_metrics_timestamp_cpu 
      ON performance_metrics (timestamp, cpu_usage)
    `);

    console.log('✅ Tabella performance_metrics creata con successo!');
    console.log('📊 Indici creati per ottimizzazione performance');

  } catch (error) {
    console.error('❌ Errore creazione tabella performance_metrics:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Esegui se chiamato direttamente
if (require.main === module) {
  createPerformanceMetricsTable()
    .then(() => {
      console.log('🎉 Setup performance_metrics completato!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Errore setup performance_metrics:', error);
      process.exit(1);
    });
}

module.exports = { createPerformanceMetricsTable };
