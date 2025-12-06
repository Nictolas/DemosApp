// Script veloce per contare i record - senza timeout
const { Pool } = require('pg');

const DATABASE_URL = 'postgres://neondb_owner:[REDACTED_NEON_PASSWORD]@ep-withered-butterfly-a2mroznt-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 5000
});

async function quickCount() {
  try {
    console.log('📊 Conteggio record...\n');
    
    // Conta centralized_logs
    const centralized = await pool.query('SELECT COUNT(*) as count FROM centralized_logs');
    console.log(`centralized_logs: ${parseInt(centralized.rows[0].count).toLocaleString()} record`);
    
    // Conta audit_logs
    const auditCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'audit_logs_compressed'
      )
    `);
    
    const tableName = auditCheck.rows[0].exists ? 'audit_logs_compressed' : 'audit_logs';
    const audit = await pool.query(`SELECT COUNT(*) as count FROM ${tableName}`);
    console.log(`${tableName}: ${parseInt(audit.rows[0].count).toLocaleString()} record`);
    
    console.log('\n✅ Conteggio completato!');
    
  } catch (error) {
    console.error('❌ Errore:', error.message);
  } finally {
    await pool.end();
  }
}

quickCount();

