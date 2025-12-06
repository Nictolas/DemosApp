// Servizio per migrare dati da Neon a Axiom
const { Pool } = require('pg');
const path = require('path');

// Inizializza pool e axiom
let pool;
let axiom;

function initializeServices() {
  // Inizializza database pool se non esiste
  if (!pool) {
    const dbUrl = process.env.DATABASE_URL;
    
    if (!dbUrl || dbUrl.includes('username:password') || dbUrl.includes('your-')) {
      throw new Error('DATABASE_URL non configurato correttamente');
    }
    
    pool = new Pool({
      connectionString: dbUrl,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
  }
  
  // Inizializza Axiom client se non esiste
  if (!axiom && process.env.AXIOM_ENABLED === 'true') {
    try {
      const axiomModule = require('@axiomhq/axiom-node');
      
      if (process.env.AXIOM_API_TOKEN && process.env.AXIOM_ORG_ID) {
        if (axiomModule.Client) {
          axiom = new axiomModule.Client({
            token: process.env.AXIOM_API_TOKEN,
            orgId: process.env.AXIOM_ORG_ID,
            region: process.env.AXIOM_REGION || 'eu'
          });
        } else {
          axiom = axiomModule;
          axiom.token = process.env.AXIOM_API_TOKEN;
          axiom.orgId = process.env.AXIOM_ORG_ID;
          axiom.region = process.env.AXIOM_REGION || 'eu';
        }
      }
    } catch (error) {
      console.error('❌ Axiom SDK non disponibile:', error.message);
    }
  }
  
  return { pool, axiom };
}

// Configurazione migrazione
const MIGRATION_CONFIG = {
  batchSize: 1000,
  delayBetweenBatches: 1000,
  maxRecords: null
};

/**
 * Converte timestamp BIGINT in ISO string
 */
function convertTimestamp(timestamp) {
  if (!timestamp) return new Date().toISOString();
  if (timestamp > 1000000000000) {
    return new Date(timestamp).toISOString();
  }
  return new Date(timestamp * 1000).toISOString();
}

/**
 * Decodifica livello log
 */
function decodeLogLevel(code) {
  const mapping = {
    'E': 'ERROR',
    'W': 'WARN',
    'I': 'INFO',
    'D': 'DEBUG',
    'T': 'TRACE'
  };
  return mapping[code] || code;
}

/**
 * Anonimizza dati se richiesto (GDPR)
 */
function anonymizeData(data, anonymize = false, anonymizeUserId = false) {
  if (!anonymize) return data;
  
  const anonymized = { ...data };
  
  if (anonymized.ip_address) {
    if (typeof anonymized.ip_address === 'string') {
      const parts = anonymized.ip_address.split('.');
      if (parts.length === 4) {
        anonymized.ip_address = `${parts[0]}.${parts[1]}.${parts[2]}.0`;
      }
    }
  }
  
  if (anonymized.user_id && anonymizeUserId) {
    const crypto = require('crypto');
    anonymized.user_id = crypto
      .createHash('sha256')
      .update(anonymized.user_id + (process.env.EXPORT_HASH_SALT || 'axiom-salt'))
      .digest('hex')
      .substring(0, 16);
  }
  
  return anonymized;
}

/**
 * Converte record centralized_logs in formato Axiom
 */
function convertCentralizedLogToAxiom(row) {
  const logEntry = {
    _time: convertTimestamp(row.timestamp || row.created_at),
    level: decodeLogLevel(row.level),
    message: row.message || '',
    log_type: 'application',
    pid: row.pid || null,
    hostname: row.hostname || null,
    user_id: row.user_id || null,
    ip_address: row.ip_address || null,
    user_agent: row.user_agent || null,
    endpoint: row.endpoint || null,
    request_id: row.request_id || null,
    session_id: row.session_id || null
  };
  
  if (row.meta_data) {
    try {
      const meta = typeof row.meta_data === 'string' 
        ? JSON.parse(row.meta_data) 
        : row.meta_data;
      Object.assign(logEntry, meta);
    } catch (e) {
      // Ignora errori parsing
    }
  }
  
  return anonymizeData(
    logEntry,
    process.env.AXIOM_ANONYMIZE === 'true',
    process.env.AXIOM_ANONYMIZE_USER_ID === 'true'
  );
}

/**
 * Converte record audit_logs in formato Axiom
 */
function convertAuditLogToAxiom(row) {
  const logEntry = {
    _time: convertTimestamp(row.timestamp || row.created_at),
    level: 'INFO',
    message: row.action || row.message || '',
    log_type: 'audit',
    action: row.action || null,
    user_id: row.user_id || null,
    user_email: row.user_email || null,
    ip_address: row.ip_address || null,
    user_agent: row.user_agent || null,
    endpoint: row.endpoint || null,
    request_id: row.request_id || null,
    resource_type: row.resource_type || null,
    resource_id: row.resource_id || null,
    details: row.details || null
  };
  
  if (row.meta_data) {
    try {
      const meta = typeof row.meta_data === 'string' 
        ? JSON.parse(row.meta_data) 
        : row.meta_data;
      Object.assign(logEntry, meta);
    } catch (e) {
      // Ignora errori parsing
    }
  }
  
  return anonymizeData(
    logEntry,
    process.env.AXIOM_ANONYMIZE === 'true',
    process.env.AXIOM_ANONYMIZE_USER_ID === 'true'
  );
}

/**
 * Migra centralized_logs
 */
async function migrateCentralizedLogs() {
  const { pool, axiom } = initializeServices();
  
  if (!axiom) {
    throw new Error('Axiom non configurato');
  }
  
  const dataset = process.env.AXIOM_DATASET || 'centralized_logs';
  
  // Conta record totali
  const countResult = await pool.query('SELECT COUNT(*) as count FROM centralized_logs');
  const totalRecords = parseInt(countResult.rows[0].count);
  
  if (totalRecords === 0) {
    console.log('📊 centralized_logs: 0 record da migrare');
    return { migrated: 0, batches: 0 };
  }
  
  console.log(`📊 centralized_logs: ${totalRecords.toLocaleString()} record da migrare`);
  
  let migrated = 0;
  let offset = 0;
  let batches = 0;
  const maxRecords = MIGRATION_CONFIG.maxRecords || totalRecords;
  
  while (migrated < maxRecords) {
    const currentBatchSize = Math.min(MIGRATION_CONFIG.batchSize, maxRecords - migrated);
    
    const result = await pool.query(`
      SELECT * FROM centralized_logs
      ORDER BY created_at ASC
      LIMIT $1 OFFSET $2
    `, [currentBatchSize, offset]);
    
    if (result.rows.length === 0) break;
    
    const axiomLogs = result.rows.map(row => convertCentralizedLogToAxiom(row));
    await axiom.datasets.ingest(dataset, axiomLogs);
    
    migrated += result.rows.length;
    offset += result.rows.length;
    batches++;
    
    console.log(`   ✅ Batch ${batches}: ${result.rows.length} record inviati (totale: ${migrated.toLocaleString()}/${totalRecords.toLocaleString()})`);
    
    if (migrated < maxRecords) {
      await new Promise(resolve => setTimeout(resolve, MIGRATION_CONFIG.delayBetweenBatches));
    }
  }
  
  console.log(`\n✅ Migrazione centralized_logs completata: ${migrated.toLocaleString()} record in ${batches} batch`);
  
  return { migrated, batches };
}

/**
 * Migra audit_logs
 */
async function migrateAuditLogs() {
  const { pool, axiom } = initializeServices();
  
  if (!axiom) {
    throw new Error('Axiom non configurato');
  }
  
  const dataset = process.env.AXIOM_REALTIME_DATASET || 'real-time';
  
  // Verifica quale tabella usare
  const tableCheck = await pool.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'audit_logs_compressed'
    )
  `);
  
  const tableName = tableCheck.rows[0].exists ? 'audit_logs_compressed' : 'audit_logs';
  
  // Conta record totali
  const countResult = await pool.query(`SELECT COUNT(*) as count FROM ${tableName}`);
  const totalRecords = parseInt(countResult.rows[0].count);
  
  if (totalRecords === 0) {
    console.log(`📊 ${tableName}: 0 record da migrare`);
    return { migrated: 0, batches: 0 };
  }
  
  console.log(`📊 ${tableName}: ${totalRecords.toLocaleString()} record da migrare`);
  
  let migrated = 0;
  let offset = 0;
  let batches = 0;
  const maxRecords = MIGRATION_CONFIG.maxRecords || totalRecords;
  
  while (migrated < maxRecords) {
    const currentBatchSize = Math.min(MIGRATION_CONFIG.batchSize, maxRecords - migrated);
    
    let query;
    if (tableName === 'audit_logs_compressed') {
      // Se è la tabella compressa, potrebbe avere una struttura diversa
      query = `
        SELECT * FROM ${tableName}
        ORDER BY created_at ASC
        LIMIT $1 OFFSET $2
      `;
    } else {
      query = `
        SELECT * FROM ${tableName}
        ORDER BY created_at ASC
        LIMIT $1 OFFSET $2
      `;
    }
    
    const result = await pool.query(query, [currentBatchSize, offset]);
    
    if (result.rows.length === 0) break;
    
    const axiomLogs = result.rows.map(row => convertAuditLogToAxiom(row));
    await axiom.datasets.ingest(dataset, axiomLogs);
    
    migrated += result.rows.length;
    offset += result.rows.length;
    batches++;
    
    console.log(`   ✅ Batch ${batches}: ${result.rows.length} record inviati (totale: ${migrated.toLocaleString()}/${totalRecords.toLocaleString()})`);
    
    if (migrated < maxRecords) {
      await new Promise(resolve => setTimeout(resolve, MIGRATION_CONFIG.delayBetweenBatches));
    }
  }
  
  console.log(`\n✅ Migrazione ${tableName} completata: ${migrated.toLocaleString()} record in ${batches} batch`);
  
  return { migrated, batches };
}

/**
 * Funzione principale di migrazione
 */
async function migrateNeonToAxiom(options = {}) {
  const { tables = ['centralized_logs', 'audit_logs'], dryRun = false } = options;
  
  const { axiom } = initializeServices();
  
  if (!axiom) {
    throw new Error('Axiom non configurato. Verifica AXIOM_ENABLED, AXIOM_API_TOKEN e AXIOM_ORG_ID');
  }
  
  console.log('🚀 Avvio migrazione dati da Neon a Axiom...\n');
  console.log(`📋 Dataset di destinazione:`);
  console.log(`   - centralized_logs → ${process.env.AXIOM_DATASET || 'centralized_logs'}`);
  console.log(`   - audit_logs → ${process.env.AXIOM_REALTIME_DATASET || 'real-time'}\n`);
  
  if (dryRun) {
    console.log('🧪 MODALITÀ DRY RUN - Nessun dato verrà inviato\n');
    
    const { pool } = initializeServices();
    
    for (const table of tables) {
      if (table === 'centralized_logs') {
        const count = await pool.query('SELECT COUNT(*) as count FROM centralized_logs');
        console.log(`📊 ${table}: ${parseInt(count.rows[0].count).toLocaleString()} record`);
      } else if (table === 'audit_logs') {
        const tableCheck = await pool.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'audit_logs_compressed'
          )
        `);
        const tableName = tableCheck.rows[0].exists ? 'audit_logs_compressed' : 'audit_logs';
        const count = await pool.query(`SELECT COUNT(*) as count FROM ${tableName}`);
        console.log(`📊 ${table}: ${parseInt(count.rows[0].count).toLocaleString()} record`);
      }
    }
    
    return { dryRun: true, tables };
  }
  
  const results = {};
  
  try {
    if (tables.includes('centralized_logs')) {
      results.centralized_logs = await migrateCentralizedLogs();
    }
    
    if (tables.includes('audit_logs')) {
      results.audit_logs = await migrateAuditLogs();
    }
    
    console.log('\n🎉 Migrazione completata!');
    console.log('\n📊 Riepilogo:');
    Object.entries(results).forEach(([table, result]) => {
      console.log(`   - ${table}: ${result.migrated.toLocaleString()} record in ${result.batches} batch`);
    });
    
    return results;
    
  } catch (error) {
    console.error('\n❌ Errore durante la migrazione:', error);
    throw error;
  }
}

module.exports = {
  migrateNeonToAxiom,
  migrateCentralizedLogs,
  migrateAuditLogs
};

