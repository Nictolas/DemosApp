const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function fixProductionDatabase() {
  try {
    console.log('🔧 Risoluzione problemi database produzione...');

    // 1. Verifica connessione
    console.log('🔍 Test connessione database...');
    await pool.query('SELECT NOW()');
    console.log('✅ Connessione database OK');

    // 2. Crea tabella centralized_logs se non esiste
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

    console.log('✅ Tabella centralized_logs creata/verificata');

    // 3. Crea tabella performance_metrics se non esiste
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

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_performance_metrics_timestamp ON performance_metrics(timestamp);
    `);

    console.log('✅ Tabella performance_metrics creata/verificata');

    // 4. Crea tabella health_checks se non esiste
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

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_health_checks_timestamp ON health_checks(timestamp);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_health_checks_status ON health_checks(status);
    `);

    console.log('✅ Tabella health_checks creata/verificata');

    // 5. Verifica tabelle esistenti
    console.log('🔍 Verifica tabelle esistenti...');
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('centralized_logs', 'performance_metrics', 'health_checks')
      ORDER BY table_name;
    `);

    console.log('📋 Tabelle monitoraggio presenti:');
    tables.rows.forEach(row => {
      console.log(`   ✅ ${row.table_name}`);
    });

    console.log('🎉 Database produzione riparato con successo!');
    console.log('🚀 Il sistema di monitoraggio ora funziona correttamente');

  } catch (error) {
    console.error('❌ Errore riparazione database:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

fixProductionDatabase().catch(console.error);
