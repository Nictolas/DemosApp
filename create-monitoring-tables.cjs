const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function createMonitoringTables() {
  try {
    console.log('🔧 Creazione tabelle sistema di monitoraggio...');

    // 1. Tabella centralized_logs
    console.log('📝 Creazione tabella centralized_logs...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS centralized_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        level VARCHAR(10) NOT NULL,
        pid INTEGER,
        hostname VARCHAR(255),
        message TEXT NOT NULL,
        user_id UUID,
        ip_address INET,
        user_agent TEXT,
        endpoint VARCHAR(500),
        request_id VARCHAR(100),
        session_id VARCHAR(100),
        meta_data JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Indici per centralized_logs
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_centralized_logs_timestamp ON centralized_logs(timestamp);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_centralized_logs_level ON centralized_logs(level);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_centralized_logs_user_id ON centralized_logs(user_id);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_centralized_logs_endpoint ON centralized_logs(endpoint);
    `);

    // 2. Tabella performance_metrics
    console.log('📊 Creazione tabella performance_metrics...');
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
      );
    `);

    // Indici per performance_metrics
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_performance_metrics_timestamp ON performance_metrics(timestamp);
    `);

    // 3. Tabella health_checks
    console.log('❤️ Creazione tabella health_checks...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS health_checks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(20) NOT NULL,
        checks JSONB NOT NULL,
        summary JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Indici per health_checks
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_health_checks_timestamp ON health_checks(timestamp);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_health_checks_status ON health_checks(status);
    `);

    console.log('✅ Tabelle sistema di monitoraggio create con successo!');
    console.log('📋 Tabelle create:');
    console.log('   - centralized_logs (logging centralizzato)');
    console.log('   - performance_metrics (metriche performance)');
    console.log('   - health_checks (controlli salute sistema)');

  } catch (error) {
    console.error('❌ Errore creazione tabelle monitoraggio:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

createMonitoringTables().catch(console.error);
