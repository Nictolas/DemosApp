const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function createAuditLogsTable() {
  try {
    console.log('🔍 Creazione tabella audit_logs per conformità GDPR...\n');

    // 1. Crea la tabella audit_logs
    console.log('1. Creazione tabella audit_logs...');
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(255) NOT NULL,
        action VARCHAR(50) NOT NULL,
        resource VARCHAR(100) NOT NULL,
        resource_id VARCHAR(255),
        details JSONB DEFAULT '{}'::jsonb,
        ip_address VARCHAR(45),
        user_agent TEXT,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        success BOOLEAN DEFAULT true,
        error_message TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    
    await pool.query(createTableQuery);
    console.log('✅ Tabella audit_logs creata');

    // 2. Crea indici per performance
    console.log('\n2. Creazione indici per performance...');
    
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);',
      'CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);',
      'CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);',
      'CREATE INDEX IF NOT EXISTS idx_audit_logs_user_action ON audit_logs(user_id, action);',
      'CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource, resource_id);'
    ];

    for (const indexQuery of indexes) {
      await pool.query(indexQuery);
    }
    console.log('✅ Indici creati');

    // 3. Crea tabella per gestione diritti utente
    console.log('\n3. Creazione tabella user_rights_requests...');
    const createRightsTableQuery = `
      CREATE TABLE IF NOT EXISTS user_rights_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(255) NOT NULL,
        request_type VARCHAR(50) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        request_data JSONB DEFAULT '{}'::jsonb,
        response_data JSONB DEFAULT '{}'::jsonb,
        processed_at TIMESTAMP WITH TIME ZONE,
        processed_by VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT valid_request_type CHECK (request_type IN ('data_export', 'data_rectification', 'data_erasure', 'data_portability', 'object_processing', 'limit_processing')),
        CONSTRAINT valid_status CHECK (status IN ('pending', 'processing', 'completed', 'rejected', 'cancelled'))
      );
    `;
    
    await pool.query(createRightsTableQuery);
    console.log('✅ Tabella user_rights_requests creata');

    // 4. Crea tabella per limitazioni trattamento
    console.log('\n4. Creazione tabella data_processing_limits...');
    const createLimitsTableQuery = `
      CREATE TABLE IF NOT EXISTS data_processing_limits (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(255) NOT NULL UNIQUE,
        processing_limited BOOLEAN DEFAULT false,
        limited_categories TEXT[] DEFAULT '{}',
        reason TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    
    await pool.query(createLimitsTableQuery);
    console.log('✅ Tabella data_processing_limits creata');

    // 5. Verifica struttura finale
    console.log('\n5. Verifica struttura tabelle...');
    const verifyQuery = `
      SELECT table_name, column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name IN ('audit_logs', 'user_rights_requests', 'data_processing_limits')
      ORDER BY table_name, ordinal_position;
    `;
    
    const result = await pool.query(verifyQuery);
    console.log('Struttura tabelle create:');
    console.table(result.rows);

    console.log('\n🎉 Setup GDPR Rights completato con successo!');
    console.log('\n📋 Prossimi passi:');
    console.log('1. Implementare endpoint API per diritti utente');
    console.log('2. Creare interfaccia utente per gestione diritti');
    console.log('3. Implementare job automatici per data retention');

  } catch (error) {
    console.error('❌ Errore durante la creazione delle tabelle:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

createAuditLogsTable().catch(console.error);
