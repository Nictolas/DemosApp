const { Pool } = require('pg');
require('dotenv').config();

// Configurazione database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function createSecurityTables() {
  try {
    console.log('🛡️ Creazione tabelle di sicurezza...');

    // Tabella eventi di sicurezza
    await pool.query(`
      CREATE TABLE IF NOT EXISTS security_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        type VARCHAR(50) NOT NULL,
        ip_address VARCHAR(45) NOT NULL,
        user_id VARCHAR(255),
        user_email VARCHAR(255),
        user_agent TEXT,
        severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
        details JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Indici per performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_security_events_type 
      ON security_events(type)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_security_events_ip 
      ON security_events(ip_address)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_security_events_created_at 
      ON security_events(created_at)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_security_events_severity 
      ON security_events(severity)
    `);

    // Tabella alert di sicurezza
    await pool.query(`
      CREATE TABLE IF NOT EXISTS security_alerts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        type VARCHAR(50) NOT NULL,
        data JSONB,
        severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
        resolved BOOLEAN DEFAULT FALSE,
        resolved_at TIMESTAMP WITH TIME ZONE,
        resolved_by VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Indici per alert
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_security_alerts_type 
      ON security_alerts(type)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_security_alerts_resolved 
      ON security_alerts(resolved)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_security_alerts_created_at 
      ON security_alerts(created_at)
    `);

    // Tabella per tracking IP sospetti
    await pool.query(`
      CREATE TABLE IF NOT EXISTS suspicious_ips (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ip_address VARCHAR(45) NOT NULL UNIQUE,
        violation_count INTEGER DEFAULT 1,
        first_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        is_blocked BOOLEAN DEFAULT FALSE,
        blocked_until TIMESTAMP WITH TIME ZONE,
        details JSONB
      )
    `);

    // Indici per IP sospetti
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_suspicious_ips_ip 
      ON suspicious_ips(ip_address)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_suspicious_ips_blocked 
      ON suspicious_ips(is_blocked)
    `);

    // Tabella per audit degli accessi
    await pool.query(`
      CREATE TABLE IF NOT EXISTS access_audit (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(255),
        ip_address VARCHAR(45) NOT NULL,
        user_agent TEXT,
        endpoint VARCHAR(255) NOT NULL,
        method VARCHAR(10) NOT NULL,
        status_code INTEGER,
        response_time_ms INTEGER,
        request_size INTEGER,
        response_size INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Indici per audit
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_access_audit_user_id 
      ON access_audit(user_id)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_access_audit_ip 
      ON access_audit(ip_address)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_access_audit_created_at 
      ON access_audit(created_at)
    `);

    // Tabella per configurazione sicurezza
    await pool.query(`
      CREATE TABLE IF NOT EXISTS security_config (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        key VARCHAR(100) NOT NULL UNIQUE,
        value JSONB NOT NULL,
        description TEXT,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Inserisci configurazioni di default
    await pool.query(`
      INSERT INTO security_config (key, value, description) VALUES
      ('rate_limits', '{"general": 100, "auth": 5, "admin": 200}', 'Limiti rate limiting'),
      ('alert_thresholds', '{"failed_logins": 5, "suspicious_requests": 20, "admin_access": 10}', 'Soglie per alert'),
      ('blocking_rules', '{"auto_block_ips": true, "block_duration_hours": 24}', 'Regole di blocco IP'),
      ('monitoring', '{"enabled": true, "retention_days": 30}', 'Configurazione monitoraggio')
      ON CONFLICT (key) DO NOTHING
    `);

    console.log('✅ Tabelle di sicurezza create con successo!');
    
    // Mostra statistiche
    const stats = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM security_events) as security_events_count,
        (SELECT COUNT(*) FROM security_alerts) as security_alerts_count,
        (SELECT COUNT(*) FROM suspicious_ips) as suspicious_ips_count,
        (SELECT COUNT(*) FROM access_audit) as access_audit_count
    `);
    
    console.log('📊 Statistiche tabelle:');
    console.log(`   - Security Events: ${stats.rows[0].security_events_count}`);
    console.log(`   - Security Alerts: ${stats.rows[0].security_alerts_count}`);
    console.log(`   - Suspicious IPs: ${stats.rows[0].suspicious_ips_count}`);
    console.log(`   - Access Audit: ${stats.rows[0].access_audit_count}`);

  } catch (error) {
    console.error('❌ Errore creazione tabelle sicurezza:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Esegui se chiamato direttamente
if (require.main === module) {
  createSecurityTables()
    .then(() => {
      console.log('🎯 Setup sicurezza completato!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Errore setup sicurezza:', error);
      process.exit(1);
    });
}

module.exports = { createSecurityTables };
